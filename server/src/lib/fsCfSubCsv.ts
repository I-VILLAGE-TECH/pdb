// futureshop サブCSV(CF: シーリングファン一覧ブック)の生成
// 現行VBA(ceilingfan/modules/futureshopその他.bas / futureshopVariation.bas / futureshop商品CSV.bas)の出力を再現する。
// - グループひもづけ: FS_categoryグループ / SetCategoryMngFS / FSカテゴリメーカー名
// - 商品タグ: FS_GoodsTag商品タグ
// - オプション(基本・選択肢): FS_goodsOptionPriceオプション(取付工事の固定4択)
// - バリエーション(選択肢登録 new/update・詳細登録・在庫): FS_goodsVariation
// - 商品画像ALT(204列): FS_ccGoodsImage画像ALT
// - 独自コメント16だけの部分更新(商品CSVと同じ111列): FS_ccGoods商品_独自コメント16_CSV
//   ※列値は商品CSVの列関数(exports.ts の FUNCS)を使うため、行生成は exports.ts 側で行う。ここでは対象判定と列名のみ
// 対象行は商品登録フラグ○(variations.listed)。生産終了の扱いは種別ごとに現行どおり
import type { Prisma } from "@prisma/client";
import { cfMakerName } from "./cfMakerNames.js";
import { cfModelConcat } from "./fsCfGoods.js";
import { fsSubCsvHeader, type FsSubFileType } from "./fsSubCsv.js";

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

// CF固有の種別(PLには無い)。FS_SUB_FILE_TYPES に追加して受ける
export const FS_CF_ONLY_FILE_TYPES = ["tag", "image_alt", "comment16"] as const;
export type FsCfOnlyFileType = (typeof FS_CF_ONLY_FILE_TYPES)[number];

// CFで出力するサブ種別(variation_price は現行CFでは未使用)
export const FS_CF_SUB_FILE_TYPES = [
  "option_basic",
  "option_select",
  "variation_choice_new",
  "variation_choice_update",
  "variation_detail",
  "variation_stock",
  "category",
  ...FS_CF_ONLY_FILE_TYPES,
] as const;
export type FsCfSubFileType = (typeof FS_CF_SUB_FILE_TYPES)[number];
export function isCfSubFileType(t: string): t is FsCfSubFileType {
  return (FS_CF_SUB_FILE_TYPES as readonly string[]).includes(t);
}

// 現行のファイル名(タイムスタンプ部を除く)。CFブックは接頭辞なし
export const FS_CF_SUB_FILE_NAMES: Record<FsCfSubFileType, string> = {
  option_basic: "FSオプション基本",
  option_select: "FSオプション選択肢",
  variation_choice_new: "FSバリエーション選択肢登録_new",
  variation_choice_update: "FSバリエーション選択肢登録_update",
  variation_detail: "FSバリエーション詳細登録",
  variation_stock: "FSバリエーション在庫",
  category: "FSグループひもづけ用",
  tag: "FS商品タグ",
  image_alt: "FS商品画像ALT",
  comment16: "FS商品データ",
};

// 分割件数(futureshop_Common.bas の SPLIT_DATA_*)
export const FS_CF_SUB_SPLIT_ROWS: Record<FsCfSubFileType, number> = {
  option_basic: 999, // SPLIT_DATA_GOODSOPTIONB
  option_select: 999, // SPLIT_DATA_GOODSOPTIONS
  variation_choice_new: 999, // SPLIT_DATA_GOODSVARIATION_CF
  variation_choice_update: 999,
  variation_detail: 999, // SPLIT_DATA_GOODSVARIATION_DT
  variation_stock: 999, // SPLIT_DATA_GOODSVARIATION_ST
  category: 5000, // SPLIT_DATA_CATEGORY
  tag: 5000, // SPLIT_DATA_GOODSTAG
  image_alt: 2000, // SPLIT_DATA_CCGOODSIMAGE
  comment16: 700, // SPLIT_DATA_CCGOODS
};

// 独自コメント16部分更新で値を入れる列(他の列は空)
export const CF_COMMENT16_COLUMNS = new Set([
  "コントロールカラム",
  "商品URLコード",
  "商品番号",
  "商品名",
  "メイングループ",
  "本体価格",
  "定価",
  "消費税",
  "独自コメント（16）",
]);

// 画像ALT(FS_ccGoodsImage 204列): 先頭4列 + 画像1〜40 × 5項目
const IMAGE_ALT_HEADER: string[] = [
  "コントロールカラム",
  "商品URLコード",
  "バリエーション紐づけ設定",
  "商品サムネイル指定",
  ...Array.from({ length: 40 }, (_, i) => {
    const n = i + 1;
    return [
      `画像${n}(ALT)`,
      `画像${n}(バリエーション枝番号)`,
      `画像${n}(バリエーション選択肢/枝番号の表示名)`,
      `画像${n}(バリエーションサムネイル設定)`,
      `画像${n}(並び順)`,
    ];
  }).flat(),
];

const TAG_HEADER = ["コントロールカラム", "タグ", "商品URLコード", "商品名", "最終更新日時"];

// comment16 のヘッダーは商品CSVと同じ(exports.ts で channel_field_maps から作る)
export function fsCfSubCsvHeader(fileType: Exclude<FsCfSubFileType, "comment16">): string[] {
  if (fileType === "tag") return TAG_HEADER;
  if (fileType === "image_alt") return IMAGE_ALT_HEADER;
  return fsSubCsvHeader(fileType as FsSubFileType);
}

// ---------- シート値の参照ヘルパー ----------

function ex(p: ProductFull): Record<string, unknown> {
  return (p.extra ?? {}) as Record<string, unknown>;
}
function exS(p: ProductFull, key: string): string {
  const v = ex(p)[key];
  return v == null ? "" : String(v);
}
// 入荷予定(INPUT_COL入荷予定)
function arrival(p: ProductFull): string {
  return p.statusNote ?? "";
}
function isEos(p: ProductFull): boolean {
  return arrival(p) === "生産終了";
}
// 商品登録優先度(△=オプション単体)
function isOptionItem(p: ProductFull): boolean {
  return exS(p, "priority") === "△";
}
function comp(p: ProductFull, role: string): string {
  return p.setComponents.find((c) => c.role === role)?.componentModel ?? "";
}
// B_ライト有無: 型番_一体型 or 型番_ライト がある
function hasLight(p: ProductFull): boolean {
  return !!p.modelNumber || !!comp(p, "LIGHT");
}
// 数値セル比較用(VBAは空セル=0として数値比較)
function num(v: string | number | { toString(): string } | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : 0;
}
// 幅・高さ・重量の生数値(取込のextra.*Raw。小数誤差込みで比較する。無ければ列値)
function rawNum(p: ProductFull, key: string, fallback: unknown): number {
  const v = ex(p)[key];
  if (typeof v === "number") return v;
  return num(fallback as string | null);
}
function widthOf(p: ProductFull): number {
  return rawNum(p, "widthRaw", p.widthMm);
}
function listed(p: ProductFull): boolean {
  return p.variations.some((v) => v.listed);
}
function makerCode(p: ProductFull): string {
  return p.maker?.makerCode ?? "";
}
function makerJp(p: ProductFull): string {
  return cfMakerName(makerCode(p), 1, exS(p, "makerCellName"));
}

// ---------- グループひもづけ(カテゴリ) ----------

const LIFT_CODES = new Set(["OXO001", "OXO002", "OXO003", "OXO004", "OXO006", "OXO007", "PXO001", "PXO002"]);

// カテゴリオプション(): △(オプション単体)のサブカテゴリ
function categoryOption(p: ProductFull): string {
  if (!isOptionItem(p)) return "";
  if (comp(p, "FLANGE")) return "フランジ(フレンジ)単体";
  if (comp(p, "PIPE")) return "延長パイプ単体";
  if (comp(p, "LIGHT")) return "照明(ライト)単体";
  if (comp(p, "REMOTE")) return "リモコン単体";
  if (comp(p, "BLADE")) return "羽根(はね)単体";
  return "その他";
}

// FSカテゴリメーカー名()
function categoryMaker(p: ProductFull): string {
  if (LIFT_CODES.has(p.productCode)) return "電動昇降機";
  if (!isOptionItem(p)) return cfMakerName(makerCode(p), 10, exS(p, "makerCellName"));
  const sub = categoryOption(p);
  return sub ? `オプション商品/${sub}` : "オプション商品";
}

const SMALL_TYPE_WIDTH = 900;
const SLIM_TYPE_HEIGHT = 350;
const LIGHT_WEIGHT_TYPE2 = 7;
const AIR_VOL_E1 = 70;

// SetCategoryMngFS(SET_CATEGORY)。GET_CATEGORY は先頭から空文字の手前まで読むため、空が出たらそこで打ち切る
export function cfFsCategories(p: ProductFull): string[] {
  const cats: string[] = [];
  const maker = categoryMaker(p);
  cats.push(maker);
  if (isEos(p)) cats.push("生産終了品");
  const done = () => {
    const i = cats.indexOf("");
    return i >= 0 ? cats.slice(0, i) : cats;
  };
  // オプション商品・電動昇降機はメーカー(+生産終了品)のみ
  if (maker.includes("オプション") || maker.includes("電動昇降機")) return done();

  const light = hasLight(p);
  const lf = light ? "ライト付き" : "ファンのみ";
  if (!maker.includes("オプション商品")) cats.push(`${maker}/${maker} ${lf}`);

  const f = p.fanAttrs;
  const width = widthOf(p);
  const sWidth = width < 1000 ? "/小型サイズ" : "/普通サイズ";
  // 天井の高さ(直付パイプ×延長パイプ)
  const mount = f?.mountType ?? "";
  const pipe = num(f?.extensionPipe);
  const isPipe = mount === "パイプ" || mount === "加工パイプ";
  const heights: string[] = [];
  if (mount === "直付" || (isPipe && pipe <= 15)) heights.push("/普通天井");
  if (isPipe && 15 < pipe && pipe <= 60) heights.push("/吹き抜け／傾斜・勾配天井(ロフト付)");
  if (isPipe && 60 <= pipe) heights.push("/1-2階吹き抜け(5m以上)");
  // アンティーク/モダン
  const color = f?.colorCategory ?? "";
  const types =
    color === "クラシック"
      ? ["/アンティーク調"]
      : color.includes("クラシック")
        ? ["/アンティーク調", "/モダン"]
        : ["/モダン"];
  for (const h of heights) for (const t of types) cats.push(`${lf}${h}${t}${sWidth}`);

  if (width < SMALL_TYPE_WIDTH) cats.push("小型・コンパクトタイプ");
  if (rawNum(p, "heightRaw", p.heightMm) <= SLIM_TYPE_HEIGHT && light) cats.push("薄型・スリムタイプ");
  if (rawNum(p, "weightRaw", p.weightKg) <= LIGHT_WEIGHT_TYPE2) cats.push("軽量・軽いタイプ");
  // 風量: 数値セル(VarType=vbDouble)なら70以上、文字列"large1"も大風量。セル型は extra.windVolumeCell で判定
  const windCell = "windVolumeCell" in ex(p) ? ex(p).windVolumeCell : f?.windVolume != null ? num(f.windVolume) : exS(p, "windVolumeRaw");
  if (typeof windCell === "number") {
    if (AIR_VOL_E1 <= windCell) cats.push(`大風量タイプ/大風量タイプ ${lf}`);
  } else if (windCell === "large1") {
    cats.push(`大風量タイプ/大風量タイプ ${lf}`);
  }
  const angled = f?.angledCeiling ?? "";
  if (angled !== "" && angled !== "NG") {
    cats.push(`傾斜・勾配・吹抜 天井用/傾斜・勾配・吹抜 天井用 ${lf}`);
  }
  if (color.includes("クラシック")) {
    cats.push(`アンティーク・クラシック/アンティーク・クラシック ${lf}`);
  }
  if (f?.motorType === "DC") cats.push(`静音・省エネ DCモーター/静音・省エネ DCモーター ${lf}`);
  if (f?.dimming === "調光・調色" || f?.dimming === "調光・光色切替") cats.push("調光・調色機能付き");
  const misc = (p.flags as Record<string, unknown> | null)?.misc;
  if (misc === "得") cats.push("ファズーお買い得商品");
  if (num(p.sellingPrice) <= 40000 && light) cats.push("40,000円以下のシーリングファンライト");
  if (arrival(p) === "即日発送" || arrival(p) === "即日OFF") {
    cats.push(`即日発送商品/即日発送商品 ${lf}`);
  }
  if (light && f?.lightKind === "LED") cats.push("LEDタイプ");
  return done();
}

// ---------- 画像ALT ----------

// 製品名(): 型番連結 + " " + メーカー(日本語) + "製シーリングファン" [+ "ライト"] [+ "【生産終了品】"]
function seihinName(p: ProductFull, modelConcat: string): string {
  let s = `${modelConcat} ${makerJp(p)}製シーリングファン`;
  if (hasLight(p)) s += "ライト";
  if (isEos(p)) s += "【生産終了品】";
  return s;
}

// ---------- バリエーション ----------

// 選択肢のあるバリエーション(シートのバリエーション1選択肢1〜3のうち値のあるもの)。項目名が空なら対象外
// 取込の extra.variationAxisRaw / variationOptsRaw(シートのセルそのまま)を優先し、無ければ variations から
function choiceVars(p: ProductFull): string[] {
  const e = ex(p);
  if (Array.isArray(e.variationOptsRaw)) {
    if (!e.variationAxisRaw) return [];
    return (e.variationOptsRaw as (string | null)[]).filter((o): o is string => !!o);
  }
  const vars = [...p.variations].sort((a, b) => a.variationNo - b.variationNo);
  if (!vars.some((v) => v.axisName)) return [];
  return vars.map((v) => v.optionValue ?? "").filter((o) => o);
}

// 詳細登録の商品名(SetVariDetail の sItemName)
function variationItemName(p: ProductFull, modelConcat: string): string {
  // 商品名セル(INPUT_COL商品名)そのまま。空セルなら空(現行は先頭が空白になる)
  let s = "productNameRaw" in ex(p) ? exS(p, "productNameRaw") : (p.summary ?? p.name);
  if (p.priceControlled || makerCode(p) === "IM") s += modelConcat;
  s += ` ${makerJp(p)}製シーリングファン`;
  if (isOptionItem(p)) s += " オプション";
  if (hasLight(p)) s += "ライト";
  s += `【${exS(p, "nameId") || p.productCode}】`;
  return s;
}

// ---------- 生成 ----------

// 独自コメント16部分更新の対象(○行・生産終了以外)
export function cfComment16Targets(products: ProductFull[]): ProductFull[] {
  return products.filter((p) => listed(p) && !isEos(p));
}

export function generateFsCfSubCsv(
  fileType: Exclude<FsCfSubFileType, "comment16">,
  products: ProductFull[]
): string[][] {
  const rows: string[][] = [];
  for (const p of products) {
    if (!listed(p)) continue;
    const code = p.productCode;
    const eos = isEos(p);

    switch (fileType) {
      case "category": {
        // 通常は n。生産終了は「生産終了品」までを n、以降を d(グループ削除)。即日OFFの即日グループは d
        let control = "n";
        for (const cat of cfFsCategories(p)) {
          let c = control;
          if (cat === "生産終了品") {
            control = "d";
          } else if (cat.includes("即日") && arrival(p) === "即日OFF") {
            c = "d";
          }
          rows.push([c, code, "", cat, "", ""]);
        }
        break;
      }
      case "tag": {
        // 空欄=登録 / d=削除。生産終了は全タグ d
        const ctl = eos ? "d" : "";
        const push = (tag: string, c = ctl) => rows.push([c, tag, code, "", ""]);
        const fanBody = ["B", "C", "E", "F"].includes(p.genreCode ?? "");
        if (fanBody) push("ファン本体");
        push("即日発送", arrival(p) === "即日発送" ? "" : "d");
        if (!fanBody) break;
        const color = p.fanAttrs?.colorCategory ?? "";
        if (color.includes("ホワイト")) push("色(白)");
        if (color.includes("ブラック")) push("色(黒)");
        if (color.includes("ブラウン") || color.includes("ナチュラル")) push("色(ブラウン／ナチュラル)");
        if (color.includes("ゴールド") || color.includes("シルバー")) push("色(ゴールド／シルバー)");
        if (color.includes("その他")) push("色(その他)");
        const pipe = num(p.fanAttrs?.extensionPipe);
        if (pipe < 30) push("パイプ延長(直付け-299mm)");
        else if (pipe < 60) push("パイプ延長(300-599mm)");
        else if (pipe < 90) push("パイプ延長(600-899mm)");
        else if (pipe < 150) push("パイプ延長(900-1499mm)");
        else push("パイプ延長(1500mm以上)");
        const motor = p.fanAttrs?.motorType ?? "";
        if (motor === "DC") push("DCモーター");
        else if (motor === "AC") push("ACモーター");
        push(hasLight(p) ? "照明あり" : "照明なし");
        const angled = p.fanAttrs?.angledCeiling ?? "";
        const angledNum = angled === "" ? 0 : Number(angled);
        push(Number.isFinite(angledNum) && angledNum >= 1 ? "傾斜あり" : "傾斜なし");
        push(widthOf(p) <= 900 ? "サイズ(小型90cm以下)" : "サイズ(普通-大)");
        break;
      }
      case "option_basic":
      case "option_select": {
        // シーリングファン本体(△以外)・生産終了以外。取付工事の固定4択
        // コントロールカラムは現行は台帳(FS_ControlCol)照合で n/u。台帳未取込のため u 固定(商品CSVの fs_control と同じ)
        if (eos || isOptionItem(p)) break;
        const item = "全国対応可能な専門店の取付工事について：";
        if (fileType === "option_basic") {
          rows.push([
            "u", code, item, "s", "0", "0", "0", "0",
            "※無料で取付工事見積もりをいたします。", "", "", "", "", "", "", "",
          ]);
        } else {
          const choices = [
            "A：お客様ご自身で取付",
            "B：ファズーに工事依頼　見積希望",
            "C：ファズーに工事依頼　相談済",
            "D：別の工事店を手配して取付",
          ];
          choices.forEach((label, i) => {
            rows.push(["u", code, item, "s", String(i), label, "", String(i), "", "", "", ""]);
          });
        }
        break;
      }
      case "variation_choice_new":
      case "variation_choice_update": {
        const control = fileType === "variation_choice_new" ? "n" : "u";
        choiceVars(p).forEach((v, i) => {
          rows.push([control, code, "", "", v, `v${i + 1}`, "", "", "", ""]);
        });
        break;
      }
      case "variation_detail": {
        const vars = choiceVars(p);
        if (vars.length === 0) break;
        const name = variationItemName(p, cfModelConcat(p));
        vars.forEach((v, i) => {
          rows.push([
            code, "", "", v, `v${i + 1}`, i === 0 ? "1" : "", "", "",
            code, `${code}v${i + 1}`, `${name} ${v}`, "", "",
          ]);
        });
        break;
      }
      case "variation_stock": {
        // 調整在庫数: 999(生産終了は0)
        choiceVars(p).forEach((_, i) => {
          rows.push([code, "", "", "", `v${i + 1}`, "", eos ? "0" : "999", "", "", "", "", ""]);
        });
        break;
      }
      case "image_alt": {
        // メイン画像(画像データM1〜M2)のうち .jpg を含むもの。1枚目=メイン画像、2枚目=イメージ画像2
        // コントロールカラムは現行は台帳照合(商品CSVと同じ)。u 固定
        // 画像データM1・M2のセル(取込の extra.fsMainImageCells。無ければ MAIN 画像)
        const cells = ex(p).fsMainImageCells;
        const m12 = Array.isArray(cells)
          ? (cells as (string | null)[]).map((c) => c ?? "")
          : p.images
              .filter((im) => im.imageType === "MAIN")
              .sort((a, b) => a.sortNo - b.sortNo)
              .map((im) => im.fileName);
        const mains = m12.filter((fn) => fn && fn !== "CUSTOM-SIZE" && fn.includes(".jpg"));
        if (mains.length === 0) break;
        const alt = seihinName(p, cfModelConcat(p));
        const row = new Array<string>(IMAGE_ALT_HEADER.length).fill("");
        row[0] = "u";
        row[1] = code;
        mains.forEach((_, i) => {
          const n = i + 1;
          if (n === 1) row[4] = `${alt} メイン画像`;
          else row[n * 5 - 1] = `${alt} イメージ画像${n}`;
        });
        rows.push(row);
        break;
      }
    }
  }
  return rows;
}
