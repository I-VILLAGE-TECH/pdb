// プラットフォーム別CSV出力
// channel_field_maps（連携先ごとの出力列定義）を解釈してSKU単位のCSVを生成する。
// 複雑変換は func: キーで本ファイルの関数へ委譲（DB設計 §5.2 / 連携同期共通設計 buildPayload に相当）
import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import iconv from "iconv-lite";
import JSZip from "jszip";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { cfComment11, cfComment12, cfComment14, cfComment15, cfComment16 } from "../lib/fsCfComments.js";
import {
  FS_SUB_FILE_TYPES,
  FS_SUB_FILE_NAMES,
  fsSubCsvHeader,
  generateFsSubCsv,
  type FsSubFileType,
} from "../lib/fsSubCsv.js";
import {
  plComment02, plComment03, plComment04, plComment05, plComment06,
  plComment07, plComment08, plComment09, plRelKey, setPlRelated, type PlRelated,
} from "../lib/fsPlComments.js";

export const exportsRouter = Router();

const exportCategoryEnum = z.enum(["PENDANT_LIGHT", "CEILING_LIGHT", "CEILING_FAN", "OTHER"]);

const filterQuery = z.object({
  channelId: z.coerce.number().int(),
  q: z.string().optional(),
  category: exportCategoryEnum.optional(),
  categories: z.array(exportCategoryEnum).optional(), // タブ切替（PLタブ=PL+CL）
  status: z
    .enum([
      "ACTIVE",
      "HIDDEN",
      "DISCONTINUED",
      "DISCONTINUED_IN_STOCK",
      "BACKORDER",
      "RESERVE",
    ])
    .optional(),
  makerId: z.coerce.number().int().optional(),
  updatedFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  updatedTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // マーク付きのみ出力（クライアントのローカルストレージから商品コードを受け取る）
  productCodes: z.array(z.string().min(1)).max(20000).optional(),
  // ファイル種別: products(商品CSV・既定) / futureshopのサブCSV各種 /
  // Excelボタン相当のセット(option_set=オプション2種, variation_set_new/update=バリエーション4種をZIPで)
  fileType: z
    .enum(["products", ...FS_SUB_FILE_TYPES, "option_set", "variation_set_new", "variation_set_update"])
    .optional(),
});

type Filter = z.infer<typeof filterQuery>;

function buildWhere(f: Filter): Prisma.ProductWhereInput {
  return {
    deletedAt: null,
    ...(f.productCodes && { productCode: { in: f.productCodes } }),
    ...(f.category && { category: f.category }),
    ...(f.categories && { category: { in: f.categories } }),
    ...(f.status && { status: f.status }),
    ...(f.makerId && { makerId: f.makerId }),
    ...((f.updatedFrom || f.updatedTo) && {
      updatedAt: {
        ...(f.updatedFrom && { gte: new Date(`${f.updatedFrom}T00:00:00+09:00`) }),
        ...(f.updatedTo && {
          lt: new Date(new Date(`${f.updatedTo}T00:00:00+09:00`).getTime() + 24 * 60 * 60 * 1000),
        }),
      },
    }),
    ...(f.q && {
      OR: [
        { productCode: { contains: f.q, mode: "insensitive" } },
        { name: { contains: f.q, mode: "insensitive" } },
        { modelNumber: { contains: f.q, mode: "insensitive" } },
        { janCode: { contains: f.q } },
        { variations: { some: { skuCode: { contains: f.q, mode: "insensitive" } } } },
      ],
    }),
  };
}

type ProductFull = Prisma.ProductGetPayload<{
  include: {
    maker: true;
    lightingAttrs: true;
    fanAttrs: true;
    variations: true;
    images: true;
    channelPrices: true;
    setComponents: true;
  };
}>;
type Variation = ProductFull["variations"][number];
type ChannelWithMaps = Prisma.ChannelGetPayload<{ include: { fieldMaps: true } }>;

// ---- source_expr の解決 ----
// - "const:xxx"            → リテラル
// - "func:xxx"             → 変換関数（下記）
// - "product.name" 等      → ドット区切りの属性参照
//   （product / variation / maker / lighting / fan が参照可）

const FUNCS: Record<
  string,
  (p: ProductFull, v: Variation, ch: ChannelWithMaps) => string | number | null
> = {
  // JAN: SKU優先、なければ商品
  jan: (p, v) => v.janCode ?? p.janCode,
  // 価格: channels.price_source に従う（channel_price=販路別価格を優先）
  price: (p, v, ch) => {
    if (ch.priceSource === "channel_price") {
      const cp = p.channelPrices.find((x) => x.channelId === ch.id);
      if (cp) return cp.price;
    }
    return v.price ?? p.totalPrice ?? p.sellingPrice;
  },
  // 在庫: channels.stock_sync_mode に従う（数量 or あり/なし）
  stock: (p, v, ch) => {
    if (ch.stockSyncMode === "AVAILABILITY") return v.stockQty > 0 ? 1 : 0;
    if (ch.stockSyncMode === "NONE") return "";
    return v.stockQty;
  },
  // バリエーション枝番の V01 形式（現行踏襲）
  variation_code: (_p, v) => `V${String(v.variationNo).padStart(2, "0")}`,
  // 表示/公開フラグ: 販売中のみ 1
  display_flag: (p) => (p.status === "ACTIVE" ? 1 : 0),
  // メイン画像ファイル名
  main_image: (p) =>
    p.images
      .filter((i) => i.imageType === "MAIN")
      .sort((a, b) => a.sortNo - b.sortNo)[0]?.fileName ?? "",
  tax_type: (p) => (p.taxType === "TAX_INCLUDED" ? "税込" : "税抜"),
  model_number: (p, v) => v.modelNumber ?? p.modelNumber,

  // ---- futureshop 商品CSV(FS_ccGoods 111列)用 ----
  // 現行VBAの再現(documents/01_調査/01_全体/04_現行VBA仕様_CSV出力.md §4.1)。
  // CF(シーリングファン)仕様を基準にし、PL(ペンダント/シーリングライト)は分岐。
  // 「TODO」の関数は並行出力比較で差分(A:未実装)として検出し順次実装する。

  // 未実装のプレースホルダ(空を出力)
  fs_todo: () => "",
  // コントロールカラム: 現行CFは台帳(FS_ControlCol)照合でn/u、PLはu固定。
  // TODO: product_channel_links の登録状態からn/u/dを判定する
  fs_control: () => "u",
  // ステータス: PL=0(掲載ON固定) / CF=空
  fs_status: (p) => (isPL(p) ? "0" : ""),
  fs_sale_from: (p) => (isPL(p) ? "" : "2012052000:00"),
  fs_sale_to: (p) => (isPL(p) ? "" : "2045040500:00"),
  fs_cool_flag: (p) => (isPL(p) ? "0" : ""),
  // PL版のみ0を出力し、CF版は空の列
  fs_pl_zero: (p) => (isPL(p) ? "0" : ""),
  // オススメ商品: CF=関連商品列に値があれば表示1+リスト(現行のSetオススメ商品*)。PLは0/空
  fs_recommend_flag: (p) => (isPL(p) ? "0" : p.relatedProducts ? "1" : ""),
  fs_recommend_list: (p) => (isPL(p) ? "" : (p.relatedProducts ?? "")),
  // 商品名: CF=「商品名 [型番] メーカー名製シーリングファン[ライト]【商品コード】」
  //         PL=「イメージ名 | 型番 メーカー名製ペンダントライト」(暫定・要比較検証)
  fs_product_name: (p) => {
    const parts: string[] = [];
    if (p.isSameDayShipping && !isPL(p)) parts.push("即日発送");
    parts.push(fsBaseName(p));
    const model = fsModel(p);
    if (!isPL(p) && model && (p.priceControlled || !p.modelNumber)) parts.push(model);
    const maker = p.maker?.nameJp ?? "";
    if (isPL(p)) {
      // PL: [取付タイプ] イメージ名 | メーカー名製ペンダントライト(種別で語尾置換)
      const inst = p.lightingAttrs?.installationType;
      // VBA準拠: [取付] + (イメージ名あり→「イメージ名 | 」) + (掲載用型番が本体型番と違えば「掲載用型番 」) + メーカー名製…
      // イメージ名が空の商品は取込時に掲載用型番がnameへフォールバックしているため、name==掲載用型番なら「イメージ名なし」扱い
      const hasImageName = p.name !== p.displayModelNumber;
      const disp = p.displayModelNumber && p.displayModelNumber !== p.modelNumber ? `${p.displayModelNumber} ` : "";
      let name = `${inst ? `[${inst}] ` : ""}${hasImageName ? `${p.name} | ` : ""}${disp}${maker}${plSuffix(p)}`;
      if (isDiscontinued(p)) name = `【生産終了品】${name}`;
      return name;
    }
    const light = (p.fanAttrs?.lightCount ?? 0) > 0 ? "ライト" : "";
    return `${parts.join(" ")} ${maker}製シーリングファン${light}【${p.productCode}】`;
  },
  // メイングループ: CF=FSカテゴリ用メーカー表記(makers.aliases.fsGroup)。
  // PL=シートのメイングループ列(summaryに取込済み)を優先し、末尾スペース等はalias(fsGroupPl)で補正
  fs_main_group: (p) => {
    if (isPL(p)) {
      const aliases = p.maker?.aliases as Record<string, unknown> | null;
      const plGroup = aliases && typeof aliases.fsGroupPl === "string" ? aliases.fsGroupPl : null;
      return plGroup ?? p.summary ?? fsMakerGroup(p);
    }
    return fsMakerGroup(p);
  },
  // 優先度: CF=並び順番号+高さ(+生産終了10万)。
  // PL=Int(幅/50)*10000+(幅/50の小数部)*100+メーカー係数(makers.sort_level)*50(+生産終了50万)
  fs_sort_priority: (p) => {
    if (isPL(p)) {
      const w = p.widthMm ?? 0;
      const level = p.maker && p.maker.sortLevel < 100 ? p.maker.sortLevel : 0;
      let v = Math.floor(w / 50) * 10000 + (w % 50) * 2 + level * 50;
      if (isDiscontinued(p)) v += 500000;
      return v;
    }
    return (isDiscontinued(p) ? 100000 : 0) + (p.sortNo ?? 0) + (p.heightMm ?? 0);
  },
  // 本体価格: FS税設定(taxType)に従い税込/税別の販売価格を切捨て
  fs_sales_price: (p) => {
    const price = isPL(p)
      ? (p.totalPrice ?? p.sellingPrice) // PL: 合計商品価格(電球込み・税込)
      : p.taxType === "TAX_INCLUDED" ? (p.sellingPrice ?? p.totalPrice) : p.sellingPriceExTax;
    return price == null ? "" : Math.floor(price);
  },
  // 定価: オープン価格(null)または定価<=販売価格 → -1(非表示)
  fs_list_price: (p) => {
    const list = p.taxType === "TAX_INCLUDED" || isPL(p) ? p.listPriceInTax : p.listPriceExTax;
    const selling = isPL(p)
      ? (p.totalPrice ?? p.sellingPrice)
      : p.taxType === "TAX_INCLUDED" ? (p.sellingPrice ?? p.totalPrice) : p.sellingPriceExTax;
    if (list == null || list <= 0) return -1;
    if (selling != null && Math.floor(list) <= Math.floor(selling)) return -1;
    return Math.floor(list);
  },
  // 消費税: PL=1固定(常に税込) / CF=税設定で1(税込)/0(税別)
  fs_tax_setting: (p) => (isPL(p) ? "1" : p.taxType === "TAX_INCLUDED" ? "1" : "0"),
  // 送料パターン: CF=販売価格1万円以上→3(全国一律送料無料)/個別設定/既定1。PL=0固定
  fs_postage_pattern: (p) => {
    if (isPL(p)) return "0";
    const price = p.sellingPrice ?? p.totalPrice ?? 0;
    if (price >= 10000) return "3";
    return p.fsShippingPattern || "1";
  },
  // 在庫管理: PL=1固定(Variationモード運用) / CF=バリエーションあり or 生産終了→1
  fs_stock_control: (p) =>
    isPL(p) ? "1" : p.variations.length > 1 || isDiscontinued(p) ? "1" : "0",
  // 現在在庫数: CF=空。PL=Variationモード相当(バリエーション運用)なら生産終了0/通常1000
  fs_current_stock: (p) => {
    if (!isPL(p)) return "";
    return isDiscontinued(p) ? "0" : "1000";
  },
  fs_variation_axis: (p) =>
    isPL(p) ? "" : (p.variations.length > 1 ? (p.variations[0]?.axisName ?? "") : ""),
  // ステータス(他社サービス): PL=0固定(生産終了でもOFFにしない現行仕様) /
  // CF=生産終了 or 入荷待ち文言つき在庫切れ→1(掲載OFF)
  fs_other_service_status: (p) =>
    isPL(p) ? "0" : isDiscontinued(p) || (p.status === "BACKORDER" && p.statusNote) ? "1" : "0",
  // JANコード: 13桁を全角化(現行のJANコードWide)
  fs_jan_wide: (p, v) => {
    const jan = (v.janCode ?? p.janCode ?? "").replace(/[',\s-]/g, "");
    if (!jan) return "";
    return jan.slice(0, 13).replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0xfee0));
  },
  fs_layout_name: (p) => {
    if (!isPL(p)) return "";
    // PL: fazoo延長保証(129列○)の有無で切替(現行のレイアウト割当名関数)
    return p.warranty === "○" ? "バリエーション" : "バリエーション(3年保証無し)";
  },
  fs_page_name: (p) => {
    if (isPL(p)) {
      // PL(VBA準拠): ○行の型番を「型番+半角スペース」で連結し、メーカー名製ペンダントライト | {% shop.name %} を後置。
      // Shift_JISで100バイト以上なら「| {% shop.name %}」を" "に置換(直前のスペースが残り末尾2スペースになる)。
      // それでも100バイト以上なら型番部をメイン行の型番のみ(後置スペースなし)にする
      const models = p.variations
        .filter((v) => v.listed && v.modelNumber)
        .map((v) => `${v.modelNumber} `)
        .join("");
      const maker = p.maker?.nameJp ?? "";
      let base = `${maker}${plSuffix(p)} | {% shop.name %}`;
      if (sjisLen(models + base) >= 100) base = base.replace("| {% shop.name %}", " ");
      let head = models;
      if (sjisLen(models + base) >= 100) {
        head =
          p.variations.find((v) => v.isRepresentative)?.modelNumber ??
          p.variations.find((v) => v.modelNumber)?.modelNumber ??
          "";
      }
      return head + base;
    }
    // CF(VBA準拠): {% product.name %}｜{% shop.name %} + 型番連結(価格統制○とMinkaAire(IM)は付けない)。
    // 全角スペース→半角、半角2連→1、Shift_JIS 100バイト以上で｜{% shop.name %}→" "、なお超過は個別カット
    const models = p.priceControlled || p.maker?.makerCode === "IM" ? "" : cfModelConcat(p);
    let page = `{% product.name %}｜{% shop.name %}${models}`;
    page = page.replace(/\u3000/g, " ").replace(/  /g, " ");
    if (sjisLen(page) >= 100) page = page.replace("｜{% shop.name %}", " ");
    if (sjisLen(page) >= 100) {
      page = page.replace(" + LLD4000MLCE1 / LLD4000MVCE1 / LLD4000MNCE1", "");
      page = page.replace(" + LLD3020MLCE1 / LLD3020MVCE1 / LLD3020MNCE1", "");
    }
    return page;
  },
  fs_keywords: (p) => {
    if (isPL(p)) return `${p.productCode},${p.maker?.nameJp ?? ""},ペンダントライト`;
    const model = fsModel(p);
    return `${model},${p.maker?.nameEn ?? ""},${p.maker?.nameJp ?? ""},シーリングファン,インテリアファン,天井扇`;
  },
  fs_description: (p) => {
    const maker = p.maker?.nameJp ?? "";
    if (isPL(p)) {
      return `${maker}製 ${p.productCode}の商品詳細ページです。ペンダントライト・ダイニング照明選びならファズーにおまかせ。専門店として選びやすく豊富な品揃え！もちろん設置方法や取り付け工事まで丁寧にサポートします。`;
    }
    const light = (p.fanAttrs?.lightCount ?? 0) > 0 ? "ライト" : "";
    const group = fsMakerGroup(p);
    return `${group}製シーリングファン${light}の商品ページ｜失敗しないシーリングファン選びなら通販専門店ファズー 吹き抜けや傾斜・勾配天井用からマンションや賃貸でも設置できる薄型・小型・軽量・ライト付きの商品を提供(${fsModel(p)})`;
  },
  // 商品説明(大): CF=「型番 メーカー英字 メーカー和名 商品コード」/ PL=空
  fs_description_large: (p) =>
    isPL(p)
      ? ""
      : [fsModel(p) || null, p.maker?.nameEn, p.maker?.nameJp, p.productCode].filter(Boolean).join(" "),
  // 外部連携任意項目(外部用キャッチコピー)。TODO: 現行の全文を再現する
  fs_catch_copy: () => "",
};

// 独自コメント(1)〜(20)。CF: 機能削除済みの枠は固定コメント、(4)(11)〜(16)(20)はHTML生成(TODO)。
// PL: (1)=メーカー・型番span、(2)〜(9)=HTML生成(TODO)、(10)〜(19)=半角スペース1文字、(20)=画像ALT文字列
const CF_FIXED_COMMENTS = new Set([1, 2, 3, 5, 6, 7, 8, 9, 10, 18, 19]);
function fsComment(p: ProductFull, n: number): string {
  if (isPL(p)) {
    if (n === 1) {
      return `<span class="pro_maker">${p.maker?.nameEn ?? ""}</span><span class="pro_fazoono">${p.productCode}</span>`;
    }
    if (n === 2) return plComment02(p);
    if (n === 3) return plComment03(p);
    if (n === 4) return plComment04(p);
    if (n === 5) return plComment05(p);
    if (n === 6) return plComment06(p);
    if (n === 7) return plComment07(p);
    if (n === 8) return plComment08(p);
    if (n === 9) return plComment09(p);
    if (n >= 10 && n <= 19) return " ";
    if (n === 20) {
      const model = p.variations.find((v) => v.isRepresentative)?.modelNumber ?? fsModel(p);
      const imageName = p.name !== p.displayModelNumber ? `${p.name} ` : "";
      return `${imageName}${p.maker?.nameJp ?? ""}${plSuffix(p)} ${model} ${p.productCode}`;
    }
    return "";
  }
  if (CF_FIXED_COMMENTS.has(n)) {
    return `<!-- ------------独自コメント（${String(n).padStart(2, "0")}）---------- -->`;
  }
  if (n === 11) return cfComment11(p);
  if (n === 12) return cfComment12(p, cfModelConcat(p));
  if (n === 14) return cfComment14(p, cfModelConcat(p));
  if (n === 15) return cfComment15(p);
  if (n === 16) return cfComment16(p);
  if (n === 17) {
    return `${fsMakerGroup(p)}製のシーリングファン選びならファズーにおまかせください【品揃え日本一】`;
  }
  return ""; // (4)(11)〜(16)(20): HTML生成(TODO)
}
for (let n = 1; n <= 20; n++) {
  FUNCS[`fs_comment_${n}`] = (p) => fsComment(p, n);
}

// CFの型番連結(現行のSet型番連結 iClass=1)。列順: 組み合わせ/一体型→ファン→ライト→パイプ→
// フランジ→リモコン→羽根→オプション→バリエーション1〜3。バリエーション型番は初出時に
// 「v1 / v2 + 」(3個時は「v1 / v2 / v3 + 」)の形でまとめて連結される
function cfModelConcat(p: ProductFull): string {
  let out = "";
  if (p.combinationModel) out = `${p.combinationModel}/`;
  const extra = (p.extra ?? {}) as Record<string, unknown>;
  const vFromExtra = Array.isArray(extra.cfVariationModels)
    ? (extra.cfVariationModels as (string | null)[])
    : null;
  // 取込済みextraがあればシートのバリエーション型番セルそのまま。無ければ複数バリエーション時のみ代用
  const vModels = vFromExtra
    ? [vFromExtra[0] ?? "", vFromExtra[1] ?? "", vFromExtra[2] ?? ""]
    : p.variations.length > 1
      ? [1, 2, 3].map((n) => p.variations.find((v) => v.variationNo === n)?.modelNumber ?? "")
      : ["", "", ""];
  const ROLE_ORDER = ["FAN", "LIGHT", "PIPE", "FLANGE", "REMOTE", "BLADE", "OPTION"];
  const cols = [
    p.modelNumber ?? "",
    ...ROLE_ORDER.map((role) => p.setComponents.find((c) => c.role === role)?.componentModel ?? ""),
    ...vModels,
  ];
  let variationDone = false;
  for (const m of cols) {
    if (!m) continue;
    if (m === vModels[0] || m === vModels[1] || m === vModels[2]) {
      if (!variationDone) {
        out += `${vModels[0]} / `;
        if (vModels[2]) out += `${vModels[1]} / ${vModels[2]} + `;
        else out += `${vModels[1]} + `;
        variationDone = true;
      }
    } else {
      out += `${m} + `;
    }
  }
  return out ? out.slice(0, -3) : "";
}

// PL系の種別語尾(製ペンダントライト/製シーリングライト等)
function plSuffix(p: ProductFull): string {
  switch (p.category) {
    case "CEILING_LIGHT":
      return "製シーリングライト";
    case "CEILING_FAN":
      return "製シーリングファン";
    case "OTHER":
      return "製";
    default:
      return "製ペンダントライト";
  }
}

// FSカテゴリ・グループ用メーカー表記(例: ダルトン／DULTON)。makers.aliases.fsGroup に持つ
function fsMakerGroup(p: ProductFull): string {
  const aliases = p.maker?.aliases as Record<string, unknown> | null;
  const fsGroup = aliases && typeof aliases.fsGroup === "string" ? aliases.fsGroup : null;
  if (fsGroup) return fsGroup;
  if (!p.maker) return "";
  return p.maker.nameEn ? `${p.maker.nameJp}／${p.maker.nameEn}` : p.maker.nameJp;
}

// 現行VBAの「型番品番」相当: 組み合わせ型番 → 本体 → ファン → ライト → パイプ…の優先順で最初の型番
const MODEL_ROLE_ORDER = ["BODY", "FAN", "LIGHT", "PIPE", "FLANGE", "REMOTE", "BLADE", "OPTION"];
function fsModel(p: ProductFull): string {
  if (p.modelNumber) return p.modelNumber;
  if (p.combinationModel) return p.combinationModel;
  for (const role of MODEL_ROLE_ORDER) {
    const c = p.setComponents.find((x) => x.role === role && x.componentModel);
    if (c) return c.componentModel;
  }
  return p.variations.find((v) => v.modelNumber)?.modelNumber ?? "";
}
// フォームの商品名: CF取込では実際の商品名がsummary側に入る(nameは内部ラベル)
function fsBaseName(p: ProductFull): string {
  return isPL(p) ? p.name : (p.summary || p.name);
}

// Shift_JIS相当のバイト長(全角2バイト換算。現行VBAのLenB(StrConv(vbFromUnicode))相当)
function sjisLen(s: string): number {
  let n = 0;
  for (const ch of s) n += ch.charCodeAt(0) > 0xff ? 2 : 1;
  return n;
}

// PLブック系か(出力仕様の分岐)。PLブックの商品コードは「XX-9999…」形式で、
// ブック内のシーリングファン商品もPL版マクロの仕様で出力される(カテゴリでは判定しない)
function isPL(p: ProductFull): boolean {
  return /^[A-Z]+-\d/.test(p.productCode);
}
function isDiscontinued(p: ProductFull): boolean {
  return p.status === "DISCONTINUED" || p.status === "DISCONTINUED_IN_STOCK" || p.status === "HIDDEN";
}

function resolveExpr(
  expr: string,
  p: ProductFull,
  v: Variation,
  ch: ChannelWithMaps
): string {
  if (expr.startsWith("const:")) return expr.slice(6);
  if (expr.startsWith("func:")) {
    const fn = FUNCS[expr.slice(5)];
    if (!fn) return `#未実装:${expr}`;
    const result = fn(p, v, ch);
    return result == null ? "" : String(result);
  }
  const ctx: Record<string, unknown> = {
    product: p,
    variation: v,
    maker: p.maker,
    lighting: p.lightingAttrs,
    fan: p.fanAttrs,
  };
  let cur: unknown = ctx;
  for (const key of expr.split(".")) {
    if (cur == null || typeof cur !== "object") return "";
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur == null ? "" : String(cur);
}

function csvField(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type ExportProgress = (phase: string, processed: number, total: number) => void;

async function generateRows(f: Filter, onProgress?: ExportProgress) {
  onProgress?.("商品データ読み込み中", 0, 0);
  const channel = await prisma.channel.findUniqueOrThrow({
    where: { id: f.channelId },
    include: { fieldMaps: { orderBy: { outputColNo: "asc" } } },
  });
  // futureshopサブCSV(PLのオプション/バリエーション各種)。行はシート順(sheetRow)
  if (f.fileType && f.fileType !== "products") {
    if (channel.code !== "futureshop") {
      throw Object.assign(new Error("このファイル種別はfutureshopのみ対応です"), { status: 400 });
    }
    const fileType = f.fileType as FsSubFileType;
    const subProducts = (await prisma.product.findMany({
      where: buildWhere(f),
      include: {
        maker: true,
        lightingAttrs: true,
        fanAttrs: true,
        variations: { orderBy: { variationNo: "asc" } },
        images: true,
        channelPrices: true,
        setComponents: true,
      },
      orderBy: [{ sheetRow: "asc" }, { id: "asc" }],
    })) as ProductFull[];
    const pls = subProducts.filter((p) => isPL(p) && p.sheetRow != null);
    onProgress?.("生成中", 0, pls.length);
    const header = fsSubCsvHeader(fileType);
    const rows = generateFsSubCsv(fileType, pls, (p) => String(FUNCS.fs_product_name(p, p.variations[0]!, channel) ?? ""));
    onProgress?.("生成中", pls.length, pls.length);
    return { channel, header, rows, fileType };
  }
  if (channel.fieldMaps.length === 0) {
    throw Object.assign(new Error("この連携先の列定義（channel_field_maps）が未登録です"), {
      status: 400,
    });
  }
  const products = await prisma.product.findMany({
    where: buildWhere(f),
    include: {
      maker: true,
      lightingAttrs: true,
      fanAttrs: true,
      variations: { orderBy: { variationNo: "asc" } },
      images: true,
      channelPrices: true,
      setComponents: true,
    },
    orderBy: { productCode: "asc" },
  });

  // PLの独自コメント(8)用: 現行の関連範囲は「メーカーID+通番が同じ"シート行"の連続」。
  // 子バリエーション行もIDセルの有無で範囲の連続/断絶に効くため、行単位の仮想シートを組み立てて範囲を求める
  if (channel.code === "futureshop") {
    const allPl = await prisma.product.findMany({
      where: { deletedAt: null, sheetRow: { not: null } },
      orderBy: [{ sheetRow: "asc" }, { id: "asc" }],
      select: {
        productCode: true,
        name: true,
        category: true,
        displayModelNumber: true,
        sheetRow: true,
        extra: true,
        lightingAttrs: { select: { installationType: true } },
        images: { where: { imageType: "MAIN" }, orderBy: { sortNo: "asc" }, take: 1 },
        variations: {
          select: { variationNo: true, listed: true, eosFlag: true, relKey: true, isRepresentative: true },
          orderBy: { variationNo: "asc" },
        },
      },
    });
    const pls = allPl.filter((g) => /^[A-Z]+-\d/.test(g.productCode));
    const meta = new Map<string, PlRelated>();
    type SheetRow = { code: string; relKey: string; listed: boolean; eos: boolean };
    const sheet: SheetRow[] = [];
    const repIndex = new Map<string, number>();
    for (const g of pls) {
      meta.set(g.productCode, {
        productCode: g.productCode,
        name: g.name,
        category: g.category,
        displayModelNumber: g.displayModelNumber,
        installationType: g.lightingAttrs?.installationType ?? null,
        mainImage: g.images[0]?.fileName ?? null,
      });
      const vars = g.variations.length > 0 ? g.variations : [{ variationNo: 1, listed: true, eosFlag: false, relKey: null, isRepresentative: true }];
      for (const v of vars) {
        // 範囲展開の起点は代表行(なければ商品の先頭行)
        if (v.isRepresentative) repIndex.set(g.productCode, sheet.length);
        sheet.push({ code: g.productCode, relKey: v.relKey ?? "", listed: v.listed, eos: v.eosFlag });
      }
      if (!repIndex.has(g.productCode)) {
        repIndex.set(g.productCode, sheet.length - vars.length);
      }
      // データ行直後のIDだけ入ったテンプレート行(取込時にID値を記録)を範囲判定用に再現
      const tmplKey = (g.extra as Record<string, unknown> | null)?.plTemplateRelKey;
      if (typeof tmplKey === "string" && tmplKey) {
        sheet.push({ code: "", relKey: tmplKey, listed: false, eos: false });
      }
    }
    const map = new Map<string, PlRelated[]>();
    for (const [code, idx] of repIndex) {
      const key = sheet[idx].relKey;
      let s0 = idx;
      let e0 = idx;
      while (s0 > 0 && sheet[s0 - 1].relKey === key) s0--;
      while (e0 < sheet.length - 1 && sheet[e0 + 1].relKey === key) e0++;
      if (s0 === e0) continue; // 範囲1行 → ブロックなし
      const items: PlRelated[] = [];
      let prev = "";
      for (let i = s0; i <= e0; i++) {
        const r = sheet[i];
        if (!r.listed || r.eos) continue;
        if (r.code === prev) continue; // 掲載済み(連続行)スキップ
        prev = r.code;
        const m = meta.get(r.code);
        if (m) items.push(m);
      }
      map.set(code, items);
    }
    setPlRelated(map);
  }

  const header = channel.fieldMaps.map((m) => m.outputHeader);
  // futureshopの商品CSVは現行仕様どおり商品単位1行(バリエーションは別CSV群で表現)。他連携先はSKU単位
  const perProduct = channel.code === "futureshop";
  const rows: string[][] = [];
  let done = 0;
  onProgress?.("生成中", 0, products.length);
  for (const p of products) {
    const targets = perProduct
      ? [p.variations.find((v) => v.isRepresentative) ?? p.variations[0]]
      : p.variations;
    for (const v of targets) {
      if (!v) continue;
      rows.push(channel.fieldMaps.map((m) => resolveExpr(m.sourceExpr, p, v, channel)));
    }
    done++;
    if (done % 100 === 0) {
      onProgress?.("生成中", done, products.length);
      // 進捗ポーリングに応答できるようイベントループへ譲る
      await new Promise((r) => setImmediate(r));
    }
  }
  onProgress?.("生成中", products.length, products.length);
  return { channel, header, rows };
}

import type { Request, Response, NextFunction } from "express";

// GET はクエリ、POST はボディ（productCodes 等の大きな条件はPOSTで受ける）
function parseFilter(req: Request): Filter {
  return filterQuery.parse(req.method === "POST" ? req.body : req.query);
}

// プレビュー（先頭N行をJSONで返す）
async function handlePreview(req: Request, res: Response, next: NextFunction) {
  try {
    const f = parseFilter(req);
    const { channel, header, rows } = await generateRows(f);
    res.json({
      channel: { code: channel.code, name: channel.name, charset: channel.charset },
      header,
      rows: rows.slice(0, 5),
      total: rows.length,
      splitRows: channel.splitRows,
    });
  } catch (e) {
    next(e);
  }
}
exportsRouter.get("/preview", handlePreview);
exportsRouter.post("/preview", handlePreview);

// CSVダウンロード
async function handleCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const f = parseFilter(req);
    const { channel, header, rows } = await generateRows(f);

    const text =
      [header.map(csvField).join(","), ...rows.map((r) => r.map(csvField).join(","))].join(
        "\r\n"
      ) + "\r\n";

    const stamp = new Date()
      .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
      .replace(/[-: ]/g, "")
      .slice(0, 12);
    // 日本語ファイル名はHTTPヘッダに直接入れられないためRFC5987(filename*)で渡す
    const isSub = f.fileType && f.fileType !== "products";
    const filename = isSub
      ? `${FS_SUB_FILE_NAMES[f.fileType as FsSubFileType]}_${stamp}.csv`
      : `${channel.code}_products_${stamp}.csv`;
    const asciiName = isSub ? `fs_${f.fileType}_${stamp}.csv` : filename;
    const dispo = `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`;

    if (channel.charset === "SHIFT_JIS") {
      res.setHeader("Content-Type", "text/csv; charset=Shift_JIS");
      res.setHeader("Content-Disposition", dispo);
      res.send(iconv.encode(text, "Shift_JIS"));
    } else {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", dispo);
      res.send("\uFEFF" + text);
    }
  } catch (e) {
    next(e);
  }
}
exportsRouter.get("/csv", handleCsv);
exportsRouter.post("/csv", handleCsv);

// ============ 進捗付きエクスポートジョブ ============
// 全件出力は生成に時間がかかるため、ジョブ開始→進捗ポーリング→完成ファイル取得の3段構成
type ExportJob = {
  id: string;
  status: "RUNNING" | "DONE" | "ERROR";
  phase: string;
  processed: number;
  total: number;
  filename?: string;
  contentType?: string;
  body?: Buffer;
  error?: string;
  startedAt: number;
};
const exportJobs = new Map<string, ExportJob>();
// 完了後30分で破棄(ダウンロードし忘れ対策で即時削除はしない)
const EXPORT_JOB_TTL_MS = 30 * 60 * 1000;
function sweepExportJobs() {
  const now = Date.now();
  for (const [id, j] of exportJobs) {
    if (now - j.startedAt > EXPORT_JOB_TTL_MS) exportJobs.delete(id);
  }
}

// Excelボタン相当のセット出力(1ボタン=複数CSVをZIPで)
const FS_SET_TYPES: Record<string, { members: FsSubFileType[]; zipName: string }> = {
  option_set: {
    members: ["option_basic", "option_select"],
    zipName: "PL_FSオプション",
  },
  variation_set_new: {
    members: ["variation_choice_new", "variation_detail", "variation_stock", "variation_price"],
    zipName: "PL_FSバリエーション_new",
  },
  variation_set_update: {
    members: ["variation_choice_update", "variation_detail", "variation_stock", "variation_price"],
    zipName: "PL_FSバリエーション_update",
  },
};

// サブCSVの分割件数(現行VBAのSPLIT_DATA_GOODSVARIATION等=999。商品CSVはchannels.split_rows=700)
const FS_SUB_SPLIT_ROWS = 999;

function buildCsvText(header: string[], rows: string[][]): string {
  return (
    [header.map(csvField).join(","), ...rows.map((r) => r.map(csvField).join(","))].join("\r\n") +
    "\r\n"
  );
}
function encodeCsv(sjis: boolean, text: string): Buffer {
  return sjis ? iconv.encode(text, "Shift_JIS") : Buffer.from("\uFEFF" + text, "utf8");
}
// 分割: limit超過時のみ分割し、各ファイルにヘッダー行を付ける(現行のSaveCopySheetFutureShopCSVと同じ)
function splitRowChunks(rows: string[][], limit: number | null | undefined): string[][][] {
  if (!limit || rows.length <= limit) return [rows];
  const chunks: string[][][] = [];
  for (let i = 0; i < rows.length; i += limit) chunks.push(rows.slice(i, i + limit));
  return chunks;
}
// 分割時はファイル名に _1.._N を付ける(単一なら無印)
function chunkFileNames(base: string, count: number): string[] {
  if (count <= 1) return [`${base}.csv`];
  return Array.from({ length: count }, (_, i) => `${base}_${i + 1}.csv`);
}

async function runExportJob(job: ExportJob, f: Filter) {
  try {
    const stamp = new Date()
      .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
      .replace(/[-: ]/g, "")
      .slice(0, 12);
    const set = f.fileType ? FS_SET_TYPES[f.fileType] : undefined;
    if (set) {
      // セット出力: メンバーごとにCSVを生成し(999行分割込み)ZIPにまとめる(現行のExcelボタン1回分)
      const zip = new JSZip();
      for (let mi = 0; mi < set.members.length; mi++) {
        const member = set.members[mi];
        const label = FS_SUB_FILE_NAMES[member];
        const { channel, header, rows } = await generateRows(
          { ...f, fileType: member },
          (phase, processed, total) => {
            job.phase = `${label} (${mi + 1}/${set.members.length}) ${phase}`;
            job.processed = processed;
            job.total = total;
          }
        );
        const chunks = splitRowChunks(rows, FS_SUB_SPLIT_ROWS);
        const names = chunkFileNames(`${label}_${stamp}`, chunks.length);
        chunks.forEach((chunk, i) => {
          zip.file(names[i], encodeCsv(channel.charset === "SHIFT_JIS", buildCsvText(header, chunk)));
        });
        await new Promise((r) => setImmediate(r));
      }
      job.phase = "ファイル作成中";
      job.body = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      job.contentType = "application/zip";
      job.filename = `${set.zipName}_${stamp}.zip`;
      job.status = "DONE";
      job.phase = "完了";
      return;
    }
    const { channel, header, rows } = await generateRows(f, (phase, processed, total) => {
      job.phase = phase;
      job.processed = processed;
      job.total = total;
    });
    job.phase = "ファイル作成中";
    await new Promise((r) => setImmediate(r));
    const isSub = f.fileType && f.fileType !== "products";
    const base = isSub
      ? `${FS_SUB_FILE_NAMES[f.fileType as FsSubFileType]}_${stamp}`
      : `${channel.code}_products_${stamp}`;
    // 分割件数: 商品CSV=channels.split_rows(futureshop 700) / サブCSV=999
    const limit = isSub ? FS_SUB_SPLIT_ROWS : channel.splitRows;
    const chunks = splitRowChunks(rows, limit);
    const sjis = channel.charset === "SHIFT_JIS";
    if (chunks.length === 1) {
      job.contentType = sjis ? "text/csv; charset=Shift_JIS" : "text/csv; charset=utf-8";
      job.body = encodeCsv(sjis, buildCsvText(header, chunks[0]));
      job.filename = `${base}.csv`;
    } else {
      // 分割時は _1.._N のCSVをZIPで(各ファイルにヘッダー行あり)
      const zip = new JSZip();
      const names = chunkFileNames(base, chunks.length);
      for (let i = 0; i < chunks.length; i++) {
        zip.file(names[i], encodeCsv(sjis, buildCsvText(header, chunks[i])));
        await new Promise((r) => setImmediate(r));
      }
      job.body = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      job.contentType = "application/zip";
      job.filename = `${base}.zip`;
    }
    job.status = "DONE";
    job.phase = "完了";
  } catch (e) {
    job.status = "ERROR";
    job.error = e instanceof Error ? e.message : String(e);
  }
}

exportsRouter.post("/jobs", (req, res, next) => {
  try {
    sweepExportJobs();
    const f = parseFilter(req);
    const job: ExportJob = {
      id: randomUUID(),
      status: "RUNNING",
      phase: "準備中",
      processed: 0,
      total: 0,
      startedAt: Date.now(),
    };
    exportJobs.set(job.id, job);
    void runExportJob(job, f);
    res.json({ jobId: job.id });
  } catch (e) {
    next(e);
  }
});

exportsRouter.get("/jobs/:id", (req, res) => {
  const job = exportJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "ジョブが見つかりません" });
  res.json({
    status: job.status,
    phase: job.phase,
    processed: job.processed,
    total: job.total,
    filename: job.filename,
    error: job.error,
  });
});

exportsRouter.get("/jobs/:id/download", (req, res) => {
  const job = exportJobs.get(req.params.id);
  if (!job || job.status !== "DONE" || !job.body) {
    return res.status(404).json({ error: "ダウンロード可能なファイルがありません" });
  }
  const ext = (job.filename ?? "").endsWith(".zip") ? "zip" : "csv";
  const ascii = /^[\x20-\x7e]+$/.test(job.filename ?? "") ? job.filename : `export.${ext}`;
  res.setHeader("Content-Type", job.contentType ?? "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(job.filename ?? "export.csv")}`
  );
  res.send(job.body);
});
