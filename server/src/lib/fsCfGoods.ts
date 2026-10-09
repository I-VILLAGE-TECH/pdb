// futureshop 商品CSV(CF版)の商品単位の列(商品名・キーワード・Description 等)
// 現行VBA(ceilingfan/modules/futureshop商品CSV.bas の SetOverwriteCSV_fs と、そこから呼ばれる
// Shopserve用.bas の共通関数: 商品名 / Set小型軽量傾斜等 / Set型番連結 / 商品ページキーワード / 並び順番号 等)を再現する。
// シートのセル値は取込済みの項目(products / product_fan_attrs / set_components / extra)から読む。
import type { Prisma } from "@prisma/client";
import { cfMakerName } from "./cfMakerNames.js";

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

// 現行の定数(Common.bas)
const AIR_VOL_E1 = 70; // 大風量 風量70以上
const SLIM_TYPE_HEIGHT = 350; // 薄型 高さ350以下
const SMALL_TYPE_WIDTH = 900; // 小型 幅900未満
const LIGHT_WEIGHT_TYPE2 = 7; // 軽量 7kg以下
// 電動昇降機(カテゴリ・商品名が特別扱い)
export const CF_LIFTER_CODES = new Set(["OXO001", "OXO002", "OXO003", "OXO004", "OXO007", "PXO001", "PXO002"]);

function extra(p: ProductFull): Record<string, unknown> {
  return (p.extra ?? {}) as Record<string, unknown>;
}
function exs(p: ProductFull, key: string): string {
  const v = extra(p)[key];
  return v == null ? "" : String(v);
}
function component(p: ProductFull, role: string): string {
  return p.setComponents.find((c) => c.role === role)?.componentModel ?? "";
}

// 入荷予定(生産ステータス)セル。VBAは「= "生産終了"」等の完全一致で判定する
export function cfArrivalStatus(p: ProductFull): string {
  return p.statusNote ?? "";
}
export function cfIsEos(p: ProductFull): boolean {
  return cfArrivalStatus(p) === "生産終了";
}
// 商品登録優先度「△」= 単体のオプション商品
export function cfIsOptionItem(p: ProductFull): boolean {
  return exs(p, "priority") === "△";
}
// B_ライト有無: 一体型 or ライトの型番がある
export function cfHasLightModel(p: ProductFull): boolean {
  return !!p.modelNumber || !!component(p, "LIGHT");
}
function makerCode(p: ProductFull): string {
  return p.maker?.makerCode ?? "";
}
export function cfMaker(p: ProductFull, iClass: number): string {
  return cfMakerName(makerCode(p), iClass, exs(p, "makerCellName") || p.maker?.nameJp);
}

// Shift_JIS相当のバイト長(VBAの LenB(StrConv(s, vbFromUnicode)) / LenByte)
function sjisLen(s: string): number {
  let n = 0;
  for (const ch of s) n += ch.charCodeAt(0) > 0xff ? 2 : 1;
  return n;
}
// 全角スペース→半角、半角2連→1(VBAの Replace 1回ずつ)
function squeeze(s: string): string {
  return s.replace(/　/g, " ").replace(/ {2}/g, " ");
}

// Set型番連結(lRow, 1) 正規型番。列順: 組み合わせ型番/ → 一体型 → ファン → ライト → パイプ → フランジ →
// リモコン → 羽根 → オプション → バリエーション1〜3。バリエーション型番は初出時に「v1 / v2 + 」(3個時は「v1 / v2 / v3 + 」)
export function cfModelConcat(p: ProductFull): string {
  let out = "";
  if (p.combinationModel) out = `${p.combinationModel}/`;
  const vFromExtra = Array.isArray(extra(p).cfVariationModels)
    ? (extra(p).cfVariationModels as (string | null)[])
    : null;
  // 取込済みextraがあればシートのバリエーション型番セルそのまま。無ければ複数バリエーション時のみ代用
  const vModels = vFromExtra
    ? [vFromExtra[0] ?? "", vFromExtra[1] ?? "", vFromExtra[2] ?? ""]
    : p.variations.length > 1
      ? [1, 2, 3].map((n) => p.variations.find((v) => v.variationNo === n)?.modelNumber ?? "")
      : ["", "", ""];
  const ROLE_ORDER = ["FAN", "LIGHT", "PIPE", "FLANGE", "REMOTE", "BLADE", "OPTION"];
  const cols = [p.modelNumber ?? "", ...ROLE_ORDER.map((role) => component(p, role)), ...vModels];
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

// Set小型軽量傾斜等: 商品名の先頭に付く特徴語(大風量/傾斜対応/LED/調光/灯数/薄型/小型/軽量)
function cfFeatureWords(p: ProductFull): string {
  const f = p.fanAttrs;
  const light = cfHasLightModel(p);
  let s = "";
  // 風量: 数値なら70以上、文字列 large1 も大風量
  const windRaw = exs(p, "windVolumeRaw");
  if (f?.windVolume != null && windRaw !== "large1") {
    if (Number(f.windVolume) >= AIR_VOL_E1) s += "大風量 ";
  } else if (windRaw === "large1") {
    s += "大風量 ";
  }
  const angle = f?.angledCeiling ?? "";
  if (angle !== "" && angle !== "NG") s += "傾斜対応 ";
  if (light) {
    if ((f?.lightKind ?? "") === "LED") s += "LED ";
    const dimming = f?.dimming ?? "";
    const color = f?.lightColor ?? "";
    if (dimming === "調光" || dimming === "無段階調光") s += `調光 ${color} `;
    else if (dimming === "調光・光色切替" || dimming === "調光・調色") s += `調光・${color} `;
    else s += `${color} `;
    if (f?.lightCount != null) s += `${f.lightCount}灯 `;
  }
  // セルの生数値で判定(小数誤差も現行どおり)。空セルは0扱い(VBAの比較)なので未入力は薄型/小型/軽量に該当する
  const raw = (key: string, fallback: unknown) => Number(extra(p)[key] ?? fallback ?? 0);
  if (raw("heightRaw", p.heightMm) <= SLIM_TYPE_HEIGHT && light) s += "薄型 ";
  if (raw("widthRaw", p.widthMm) < SMALL_TYPE_WIDTH) s += "小型 ";
  if (raw("weightRaw", p.weightKg) <= LIGHT_WEIGHT_TYPE2) s += "軽量 ";
  return s;
}

// 商品名(lRow): 特徴語 + 商品名セル + [型番] + メーカー名製シーリングファン[ライト]【商品名ID】[【生産終了品】]
function cfBaseProductName(p: ProductFull): string {
  const eos = cfIsEos(p);
  const option = cfIsOptionItem(p);
  let s = !eos && !option ? cfFeatureWords(p) : "";
  s += exs(p, "productNameRaw");
  if (p.priceControlled || makerCode(p) === "IM") s += cfModelConcat(p); // 価格統制・MinkaAireは型番表示
  s += ` ${cfMaker(p, 1)}製`;
  if (CF_LIFTER_CODES.has(p.productCode)) {
    s += " 電動昇降機・電動昇降装置";
  } else {
    s += option ? "シーリングファン オプション" : "シーリングファン";
    if (cfHasLightModel(p)) s += "ライト";
  }
  s += `【${exs(p, "nameId") || p.productCode}】`;
  if (eos) s += "【生産終了品】";
  if (sjisLen(s) > 128) {
    s = s.replace("[軽量]", "");
    if (sjisLen(s) > 256) s = s.replace("[薄型]", "");
    if (sjisLen(s) > 256) s = s.replace("[傾斜天井]", "");
  }
  return s;
}

// FS商品名: 即日発送は先頭に付け、全角スペース→半角・2連スペース→1
export function cfFsProductName(p: ProductFull): string {
  let s = cfBaseProductName(p);
  if (cfArrivalStatus(p) === "即日発送") s = `即日発送 ${s}`;
  return squeeze(s);
}

// 商品ページキーワード: 型番群 + メーカー検索キーワード + シーリングファン(ライト),インテリアファン,天井扇
export function cfPageKeywords(p: ProductFull): string {
  let s = "";
  if (p.combinationModel) s = `${p.combinationModel},`;
  for (const m of [
    p.modelNumber ?? "",
    component(p, "FAN"),
    component(p, "LIGHT"),
    component(p, "PIPE"),
    component(p, "FLANGE"),
    component(p, "REMOTE"),
    component(p, "BLADE"),
    component(p, "OPTION"),
  ]) {
    if (m) s += `${m},`;
  }
  const vModels = Array.isArray(extra(p).cfVariationModels) ? (extra(p).cfVariationModels as (string | null)[]) : [];
  for (const v of vModels) {
    if (v && !s.includes(v)) s += `${v},`;
  }
  s += cfMaker(p, 16);
  s += cfHasLightModel(p) ? "シーリングファンライト," : "シーリングファン,";
  return `${s}インテリアファン,天井扇`;
}

// 商品説明（大）: キーワードから固定語を除き、カンマを空白にして商品コードを付ける
export function cfDescriptionLarge(p: ProductFull): string {
  const s = cfPageKeywords(p)
    .replace("シーリングファンライト,", "")
    .replace("シーリングファン,", "")
    .replace("インテリアファン,", "")
    .replace("天井扇", "")
    .replace(/,/g, " ");
  return `${s}${p.productCode}`;
}

// Description(コマースクリエイター): Shift_JIS 250バイト未満になるまで文言を短いパターンへ切り替える
export function cfDescription(p: ProductFull): string {
  const head = squeeze(`${cfMaker(p, 8)}${cfHasLightModel(p) ? "シーリングファンライト" : "シーリングファン"}`);
  const model = squeeze(`(${cfModelConcat(p)})`);
  const patterns = [
    "の商品ページ｜失敗しないシーリングファン選びなら通販専門店ファズー 吹き抜けや傾斜・勾配天井用からマンションや賃貸でも設置できる薄型・小型・軽量・ライト付きの商品を提供",
    "の商品ページ｜失敗しないシーリングファン選びなら通販専門店ファズー 吹き抜けや傾斜天井用からマンションに適した薄型・小型・軽量の商品を提供",
    "の商品ページ｜失敗しないシーリングファン選びなら通販専門店ファズー 吹き抜け天井や賃貸マンションでも設置できる商品を提供",
    "の商品ページ｜失敗しないシーリングファン選びなら通販専門店ファズー",
  ];
  let s = "";
  for (const body of patterns) {
    s = `${head}${body}${model}`;
    if (sjisLen(s) < 250) break;
  }
  return s;
}

// 定価(lRow): オープン価格(o/O)は0、それ以外はセル値
function cfListPriceCell(p: ProductFull): number {
  const raw = exs(p, "listPriceRaw");
  if (raw === "o" || raw === "O") return 0;
  return p.listPriceInTax ?? 0;
}
// 取消線: 定価が0(オープン価格)なら0
export function cfStrikeThrough(p: ProductFull): string {
  return cfListPriceCell(p) === 0 ? "0" : "1";
}

// 在庫管理: バリエーション項目名あり or 生産終了 → 1
export function cfStockControl(p: ProductFull): string {
  const axis = p.variations.find((v) => v.isRepresentative)?.axisName ?? p.variations[0]?.axisName ?? "";
  return axis !== "" || cfIsEos(p) ? "1" : "0";
}
export function cfVariationAxis(p: ProductFull): string {
  return p.variations.find((v) => v.isRepresentative)?.axisName ?? p.variations[0]?.axisName ?? "";
}

// ステータス（他社サービス）: 生産終了・ジャンルL/O → 1。在庫切れ/即日切れで入荷待ち文言あり → 1
export function cfOtherServiceStatus(p: ProductFull): string {
  const st = cfArrivalStatus(p);
  const genre = p.genreCode ?? "";
  if (st === "生産終了" || genre === "L" || genre === "O") return "1";
  const waiting = exs(p, "arrivalText");
  if ((st === "在庫切れ" || st === "即日切れ") && waiting !== "") return "1";
  return "0";
}

// JANコードWide: セル生値の「'」「,」を除き先頭13文字を全角化(StrConv vbWide。半角スペースも全角になる)
export function cfJanWide(p: ProductFull): string {
  const raw = extra(p).janRaw != null ? exs(p, "janRaw") : (p.janCode ?? "");
  if (raw === "-" || raw === "'-") return "";
  const s = raw.replace(/'/g, "").replace(/,/g, "").slice(0, 13);
  return s.replace(/[\x20-\x7e]/g, (c) => (c === " " ? "　" : String.fromCharCode(c.charCodeAt(0) + 0xfee0)));
}

// 優先度(並び順番号): 生産終了 +100000 + 並び順番号 + 高さ
export function cfSortPriority(p: ProductFull): number {
  return (cfIsEos(p) ? 100000 : 0) + (p.sortNo ?? 0) + (p.heightMm ?? 0);
}

// 独自コメント（17）: ヘッダーH1 Alt用
export function cfComment17(p: ProductFull): string {
  const maker = cfMaker(p, 8);
  if (cfIsOptionItem(p)) return `${maker}シーリングファン オプション選びならファズーにおまかせください【品揃え日本一】`;
  return cfHasLightModel(p)
    ? `${maker}のシーリングファン・ライト選びならファズーにおまかせください【品揃え日本一】`
    : `${maker}のシーリングファン選びならファズーにおまかせください【品揃え日本一】`;
}
