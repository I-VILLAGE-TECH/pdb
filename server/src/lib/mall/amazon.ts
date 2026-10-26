// Amazon 向けファイルの出力定義(現行マクロの再現)。仕組みは lib/mallCsv.ts を参照
// 現行: シーリングファン一覧ブック ボタン「CSV_Amazon」= SetSelectRangeCSV_amazon(ceilingfan/modules/Amazon作成用.bas)。
// IV(自社)用「Amazon(new)」シートと SD(相乗り)用「Amazon(SD)」シートに1商品ずつ書き、シートごとテキスト(xlText)保存する。
// 依存: Shopserve用.bas(Set型番連結 / B_ライト有無 / Setメーカー名 / LenB_UTF8 / CutText_UTF8)、futureshopPublic.bas(ImgFileNameToFilePath)、
//       Common.bas(LEAVE_SETTING / LEAVE_TEXT / LEAVE_TEXT_SD / AIR_VOL_* / 各しきい値)
//
// 再現方針(業務確認一覧に記載):
// - ASIN一覧シート(Amazon(IV-ASIN)/(SD-ASIN))は取込時に extra.amazonAsin へ持たせ、SKU 完全一致(最後の行)で参照する。
//   重複SKUがあれば現行どおり出力を中止する(エラー)。
// - 現行の Stop は「続行(F5)」した場合の結果を再現する(画像の取付区分が○でない → メイン画像 "ERROR" 等。現行出力にも出ている)。
// - 生産終了の削除更新確認(MsgBox)は「はい」扱い。
// - セル書き込み時の Excel の型変換(数値文字列→数値、"false"→FALSE、先頭「'」は文字列)を出力時に再現する。
// - 在庫切れ(即日切れ)のバリエーション子行は A列(feed_product_type)が空のため現行では次商品に上書き/空行削除で消える → 出さない。
// - 入荷予定日の判定(Cells(予約開始) > Date)は VBA の Variant 比較を再現(空文字列セルも「今日より後」= 在庫5・入荷予定日空)。
import type { MallFileSpec, MallSetSpec, ProductFull } from "../mallCsv.js";
import { cfHasLightModel, cfMaker, cfModelConcat } from "../fsCfGoods.js";
import { cfImgFolder } from "../fsCfComments.js";
import { AMAZON_HEADER, AMAZON_TEMPLATE_ROW1, AMAZON_TEMPLATE_ROW2 } from "./amazonTemplate.js";

// ---------- 定数(Common.bas / Amazon作成用.bas) ----------
const IMG_URL = "https://www.fazoo.biz/cf_item_img/";
const LEAVE_SETTING = 0; // 休暇時のリードタイム加算(通常0)
// 休暇文言: 現行は Common.bas の定数をコメント切替で運用。通常期の文言で固定(要業務確認: 設定化)
const LEAVE_TEXT = "（休業日：土曜/日曜/祝日/お盆/年末年始）";
const LEAVE_TEXT_SD = "【休業日：土曜/日曜/祝日/お盆/年末年始】";
const AIR_VOL_E11 = 80;
const AIR_VOL_E1 = 70;
const SLIM_TYPE_HEIGHT = 350;
const SMALL_TYPE_WIDTH = 900;
const LIGHT_WEIGHT_TYPE1 = 5;
const LIGHT_WEIGHT_TYPE2 = 7;
const TYPE_IV = 1;
const TYPE_SD = 2;

// 列番号(1始まり。Common.bas の Amazon_COL_*)。189列目まではテンプレートの列キーから引く
const COL_END = 209;
function col(key: string): number {
  const i = AMAZON_HEADER.indexOf(key);
  if (i < 0) throw new Error(`Amazon列キーがありません: ${key}`);
  return i + 1;
}
const C = {
  feed_product_type: col("feed_product_type"),
  item_sku: col("item_sku"),
  external_product_id: col("external_product_id"),
  external_product_id_type: col("external_product_id_type"),
  item_name: col("item_name"),
  recommended_browse_nodes: col("recommended_browse_nodes"),
  part_number: col("part_number"),
  main_image_url: col("main_image_url"),
  quantity: col("quantity"),
  standard_price: col("standard_price"),
  other_image_url1: col("other_image_url1"),
  swatch_image_url: col("swatch_image_url"),
  relationship_type: col("relationship_type"),
  variation_theme: col("variation_theme"),
  parent_sku: col("parent_sku"),
  parent_child: col("parent_child"),
  update_delete: col("update_delete"),
  brand_name: col("brand_name"),
  model: col("model"),
  product_description: col("product_description"),
  manufacturer: col("manufacturer"),
  color_map: col("color_map"),
  wattage: col("wattage"),
  bullet_point1: col("bullet_point1"),
  generic_keywords: col("generic_keywords"),
  color_name: col("color_name"),
  size_name: col("size_name"),
  size_map: col("size_map"),
  package_length: col("package_length"),
  package_weight_unit_of_measure: col("package_weight_unit_of_measure"),
  package_height: col("package_height"),
  fulfillment_center_id: col("fulfillment_center_id"),
  package_width: col("package_width"),
  package_weight: col("package_weight"),
  batteries_required: col("batteries_required"),
  are_batteries_included: col("are_batteries_included"),
  supplier_declared_dg_hz_regulation1: col("supplier_declared_dg_hz_regulation1"),
  country_of_origin: col("country_of_origin"),
  fulfillment_latency: col("fulfillment_latency"),
  merchant_shipping_group_name: col("merchant_shipping_group_name"),
  optional_payment_type_exclusion: col("optional_payment_type_exclusion"),
  distribution_designation: col("distribution_designation"),
  merchant_release_date: col("merchant_release_date"),
  list_price: col("list_price"),
  restock_date: col("restock_date"),
  offering_can_be_giftwrapped: col("offering_can_be_giftwrapped"),
  max_order_quantity: col("max_order_quantity"),
  offering_can_be_gift_messaged: col("offering_can_be_gift_messaged"),
  condition_type: col("condition_type"),
  condition_note: col("condition_note"),
  standard_price_points_percent: col("standard_price_points_percent"),
  sale_price: col("sale_price"),
  sale_from_date: col("sale_from_date"),
  sale_price_points_percent: col("sale_price_points_percent"),
  sale_end_date: col("sale_end_date"),
  // テンプレート外(190列目以降。現行でもシートには書くが常に空のため出力されない)
  delivery_schedule_group_id: 191,
  material_type_free: 200,
  blade_length_unit_of_measure: 209,
} as const;

// ---------- セル値・VBA型変換 ----------
type Raw = string | number | boolean | null | undefined;
type Asin = { id: Raw; type: Raw; ch: Raw; dup?: boolean };

function ex(p: ProductFull): Record<string, unknown> {
  return (p.extra ?? {}) as Record<string, unknown>;
}
function cells(p: ProductFull): Record<string, unknown> {
  return (ex(p).amazonCells ?? {}) as Record<string, unknown>;
}
function cell(p: ProductFull, key: string): Raw {
  return cells(p)[key] as Raw;
}
function exs(p: ProductFull, key: string): string {
  const v = ex(p)[key];
  return v == null ? "" : String(v);
}
// VBA CStr(Double): 有効15桁
function vbNum(n: number): string {
  if (!Number.isFinite(n)) return "";
  return String(Number(n.toPrecision(15)));
}
// セル値の文字列化(VBA の `& Cells(...)` / String 代入)
function str(v: Raw): string {
  if (v == null) return "";
  if (typeof v === "number") return vbNum(v);
  if (typeof v === "boolean") return v ? "True" : "False";
  return v;
}
// セル値の数値化(VBA の比較・加算で空セルは0)
function num(v: Raw): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
// VBA: 数値セルと数値の比較。文字列セル(数値に変換できない)は数値より大きい扱い
function lt(v: Raw, n: number): boolean {
  const x = num(v);
  return Number.isNaN(x) ? false : x < n;
}
function le(v: Raw, n: number): boolean {
  const x = num(v);
  return Number.isNaN(x) ? false : x <= n;
}
// CInt(銀行丸め)
function vbRound(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return Math.round(x);
}
function utf8Len(s: string): number {
  return Buffer.byteLength(s, "utf8");
}
// CutText_UTF8: 指定バイト以下になるまで削り、さらに3文字削ってごみタグを除き "..." を付ける
function cutTextUtf8(input: string, cutBytes: number): string {
  let s = input;
  let len = utf8Len(s);
  while (cutBytes < len) {
    const cut = vbRound((len - cutBytes) / 2) + 1;
    s = s.slice(0, s.length - cut);
    len = utf8Len(s);
  }
  s = s.slice(0, s.length - 3);
  const n = s.length;
  if (s.charAt(n - 1) === "<") s = s.slice(0, n - 1);
  else if (s.charAt(n - 2) === "<") s = s.slice(0, n - 2);
  else if (s.charAt(n - 3) === "<") s = s.slice(0, n - 3);
  else if (s.charAt(n - 4) === "<") s = s.slice(0, n - 4);
  return `${s}...`;
}

// Excel のセル書き込み時の型変換 + テキスト保存時の表示(標準書式)
function excelGeneral(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e11) return String(n);
  if (Math.abs(n) >= 1e11) {
    const [m, e] = n.toExponential(5).split("e");
    const mant = m.replace(/\.?0+$/, "");
    const exp = Number(e);
    return `${mant}E${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  return String(Number(n.toPrecision(10)));
}
// 「Amazon(new)」「Amazon(SD)」シートの C列(external_product_id)は表示形式「0_ 」(数値の後ろに半角スペース)。
// ASIN一覧の商品IDが数値(JAN)のとき現行出力は「4963088928009 」になる
const NUMBER_FORMAT_0_SPACE = new Set([3]);
function excelCell(v: string, colNo: number): string {
  if (v === "") return "";
  if (v.startsWith("'")) return v.slice(1);
  if (/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(v)) {
    if (NUMBER_FORMAT_0_SPACE.has(colNo)) return `${Math.round(Number(v))} `;
    return excelGeneral(Number(v));
  }
  const lower = v.toLowerCase();
  if (lower === "true") return "TRUE";
  if (lower === "false") return "FALSE";
  return v;
}

// 今日(JST)。比較検証用に AMAZON_TODAY=yyyy-mm-dd で上書き可
function todayYmd(): string {
  if (process.env.AMAZON_TODAY) return process.env.AMAZON_TODAY.replace(/\//g, "-");
  return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
}
// VBA: Cells(予約開始) > Date
// 日付セルは取込で ISO 文字列(cellRaw)。それ以外の文字列はシート上の文字列
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;
function isAfterToday(v: Raw): boolean {
  if (v == null) return false; // 空セル(Empty)は 0 扱い
  const today = todayYmd();
  if (typeof v === "number") {
    const serial = (Date.parse(`${today}T00:00:00Z`) - Date.parse("1899-12-30T00:00:00Z")) / 86400e3;
    return v > serial;
  }
  if (typeof v === "boolean") return false;
  // VBA の Variant 比較では文字列は日付(数値)より大きい。空文字列のセル("")でも真になる(現行の在庫5・入荷予定日空はこれ)
  if (!ISO_DATE.test(v)) return true;
  const d = new Date(v);
  const pad = (x: number) => String(x).padStart(2, "0");
  const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0;
  return ymd > today || (ymd === today && hasTime);
}
// SetRestockDate: 識別番号=3 かつ 予約開始 > 今日 なら予約開始セルの値(日付は Excel 表示 yyyy/m/d)
function restockDate(p: ProductFull): string {
  const v = cell(p, "reserveStart");
  if (!(num(ex(p).identNo as Raw) === 3 && isAfterToday(v))) return "";
  if (typeof v === "string" && ISO_DATE.test(v)) {
    const d = new Date(v);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }
  return str(v);
}
// DateValue(cell) → "yyyy-mm-dd" + "T00:00:00+09:00"
function vbDateIso(v: Raw): string {
  if (v == null || v === "") return "";
  let d: Date;
  if (typeof v === "number") d = new Date(Date.parse("1899-12-30T00:00:00") + Math.floor(v) * 86400e3);
  else d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00+09:00`;
}

// ---------- 商品の読み取り ----------
function status(p: ProductFull): string {
  return p.statusNote ?? "";
}
function makerCode(p: ProductFull): string {
  return p.maker?.makerCode ?? "";
}
function priority(p: ProductFull): string {
  return exs(p, "priority");
}
function sku(p: ProductFull): string {
  return p.productCode;
}
function install(p: ProductFull, i: number): string {
  const arr = cells(p).install;
  return Array.isArray(arr) ? str(arr[i] as Raw) : "";
}
function imageCell(p: ProductFull, idx: number): string {
  const arr = ex(p).cfImageCells;
  return Array.isArray(arr) ? str(arr[idx] as Raw) : "";
}
function windCell(p: ProductFull): Raw {
  return ex(p).windVolumeCell as Raw;
}
function angled(p: ProductFull): string {
  return str(ex(p).angledRaw as Raw);
}
function axis(p: ProductFull): string {
  return exs(p, "variationAxisRaw");
}
function variationOpt(p: ProductFull, i: number): string {
  const arr = ex(p).variationOptsRaw;
  return Array.isArray(arr) ? str(arr[i - 1] as Raw) : "";
}
function asin(p: ProductFull, kind: "iv" | "sd", key: string): Asin | null {
  const a = (ex(p).amazonAsin ?? {}) as Record<string, Record<string, Asin>>;
  return a[kind]?.[key] ?? null;
}

// Set型番連結(lRow, 3): 組み合わせ型番/ + 一体型 or ファン
function modelMain(p: ProductFull): string {
  let s = p.combinationModel ? `${p.combinationModel}/` : "";
  const fan = p.setComponents.find((c) => c.role === "FAN")?.componentModel ?? "";
  if (p.modelNumber) s += p.modelNumber;
  else if (fan) s += fan;
  return s;
}

// ---------- 各列(Set*) ----------
function itemName(p: ProductFull): string {
  const light = cfHasLightModel(p);
  const f = p.fanAttrs;
  let s = `${cfMaker(p, 1)} `;
  if (priority(p) !== "△") s += light ? "シーリングファン ライト " : "シーリングファン ";
  else s += "シーリングファン オプション ";
  if (str(cell(p, "priceControl")) === "○") {
    s += `${exs(p, "productNameRaw")} ${cfModelConcat(p)} `;
  }
  if (priority(p) !== "△") {
    if (p.bodyColor) s += `${p.bodyColor} `;
    if ((f?.lightKind ?? "") === "LED" && light) s += "LED ";
    const tatami = ex(p).tatamiToRaw as number | null;
    if (tatami != null && light) {
      if (tatami === 8) s += "明るさ8畳 ";
      else if (tatami === 10) s += "明るい10畳 ";
      else if (tatami === 12) s += "明るい12畳 ";
      else if (tatami === 14) s += "明るい14畳 ";
    }
    if (lt(cell(p, "height"), SLIM_TYPE_HEIGHT)) s += "薄型 ";
    if (lt(cell(p, "width"), SMALL_TYPE_WIDTH)) s += "小型 ";
    const w = cell(p, "weight");
    if ((le(w, LIGHT_WEIGHT_TYPE1) && !light) || (le(w, LIGHT_WEIGHT_TYPE2) && light)) s += "軽量 ";
    if ((f?.motorType ?? "") === "DC") s += "DCモーター"; // 現行どおり後ろにスペースなし
    const wind = windCell(p);
    if (typeof wind === "number") {
      if (wind >= AIR_VOL_E11 || wind >= AIR_VOL_E1) s += "大風量 ";
    } else if (wind === "large1") s += "大風量 ";
    const ang = angled(p);
    if (ang !== "" && ang !== "NG") s += "吹き抜け 傾斜天井 ";
    const remote = exs(p, "remoteRaw");
    if (["あり", "1ch", "2ch", "3ch", "4ch"].includes(remote)) s += "リモコン ";
    else if (remote === "プルSW") s += "プルスイッチ ";
    if (install(p, 0) !== "") s += "簡易取付 ";
    else if (install(p, 1) !== "") s += "一部電気工事 ";
    else if (install(p, 2) !== "") s += "簡易取付 ";
    else if (install(p, 3) !== "") s += "電気工事 ";
    else if (install(p, 4) !== "") s += "電気工事 ";
  }
  const code = sku(p);
  s += `【${code.slice(0, 3)}-${code.slice(-3)}】`;
  if (s.length > 191) {
    s = s.replace(/ リモコン/g, "");
    if (s.length > 191) s = s.replace(/ 傾斜天井/g, "");
  }
  return s;
}

function productId(p: ProductFull, target: string): string {
  const a = asin(p, "iv", target);
  if (a) return str(a.id);
  if (makerCode(p) === "I") {
    const jan = str(ex(p).janRaw as Raw);
    return jan.length === 13 ? `'${jan}` : "";
  }
  return "";
}
function productIdType(p: ProductFull, target: string): string {
  const a = asin(p, "iv", target);
  if (a) {
    const t = num(a.type);
    if (t === 1) return "ASIN";
    if (t === 3) return "UPC";
    if (t === 4) return "EAN";
    return str(a.type);
  }
  if (makerCode(p) === "I") return str(ex(p).janRaw as Raw).length === 13 ? "EAN" : "";
  return "";
}
function brand(p: ProductFull): string {
  return cfMaker(p, 7);
}
function manufacturer(p: ProductFull): string {
  return makerCode(p) === "I" ? "トヨスター" : cfMaker(p, 1);
}
function partNumber(p: ProductFull): string {
  return makerCode(p) === "I" ? modelMain(p) : sku(p);
}
function model(p: ProductFull): string {
  return makerCode(p) === "I" ? modelMain(p) : "";
}
function description(p: ProductFull): string {
  const sub1 = exs(p, "subIntro1Raw");
  const ind = exs(p, "subIndividualCell");
  let s = "";
  if (sub1 !== "") s = `${sub1}\r\n<br>\r\n`;
  else if (ind !== "") s = `${ind}\r\n<br>\r\n`;
  s = s.replace(/<\/strong>/g, "").replace(/<strong>/g, "").replace(/\r\n/g, "");
  if (utf8Len(s) > 2000) s = cutTextUtf8(s, 2000);
  return s;
}

function updateDelete(p: ProductFull, kind: "iv" | "sd", target: string): string {
  const a = asin(p, kind, target);
  let r: string;
  if (a) {
    const ch = str(a.ch);
    r = ch === "DEFAULT" || ch === "AMAZON_JP" ? "PartialUpdate" : ch;
  } else r = "Update";
  const st = status(p);
  if (st === "在庫切れ" || st === "即日切れ") r = "PartialUpdate";
  if (st === "生産終了") r = str(ex(p).amazonDeleteFlag as Raw) === "○" ? "Delete" : "PartialUpdate";
  return r;
}
function isFba(p: ProductFull, kind: "iv" | "sd", target: string): boolean {
  return str(asin(p, kind, target)?.ch) === "AMAZON_JP";
}
function quantity(p: ProductFull, kind: "iv" | "sd", target: string): string {
  const st = status(p);
  let r: string;
  if (st === "即日発送") r = "2";
  else if (st === "生産終了") r = "0";
  else if (st === "在庫切れ" || st === "即日切れ") {
    r = num(ex(p).identNo as Raw) === 3 && isAfterToday(cell(p, "reserveStart")) ? "5" : "0";
  } else r = "10";
  return isFba(p, kind, target) ? "" : r;
}
function fulfillmentLatency(p: ProductFull, target: string): string {
  let r = status(p) === "即日発送" ? 1 : num(cell(p, "normalLeadTime")) + 1;
  if (LEAVE_SETTING > 0) r += LEAVE_SETTING;
  return isFba(p, "iv", target) ? "" : vbNum(r);
}
function fulfillmentCenterId(p: ProductFull, kind: "iv" | "sd", target: string): string {
  const a = asin(p, kind, target);
  if (!a) return "";
  const ch = str(a.ch);
  return ch === "DEFAULT" ? "" : ch;
}

// SetListPrice: "O"=オープン価格は空。0以下・未入力は Stop(続行で空)
function listPrice(p: ProductFull): string {
  const raw = ex(p).listPriceRaw as Raw;
  if (str(raw) === "O") return "";
  const n = num(raw);
  return n > 0 ? vbNum(n) : "";
}
// ItemPrice: 販売価格2。定価を超える場合は定価。利率15%以下かつ利益3000円未満は Stop(続行で空)
function itemPrice(p: ProductFull): string {
  let sales = vbRound(num(cell(p, "amazonPrice")));
  const cost = Math.floor(num(cell(p, "cost")));
  const lp = listPrice(p);
  const lPrice = lp !== "" ? vbRound(Number(lp)) : 0;
  if (lPrice !== 0 && lPrice < sales) sales = lPrice;
  if (1 - cost / sales <= 0.15 && sales - cost < 3000) return "";
  return String(Math.floor(sales));
}
function standardPrice(p: ProductFull): string {
  if (num(ex(p).identNo as Raw) === 2) return listPrice(p); // セール時は定価
  return itemPrice(p);
}
function isSale(p: ProductFull): boolean {
  return num(ex(p).identNo as Raw) === 2;
}
function merchantReleaseDate(p: ProductFull): string {
  return status(p) === "予約販売" ? vbDateIso(cell(p, "reserveEnd")) : "";
}
function paymentExclusion(p: ProductFull): string {
  return status(p) === "即日発送" ? "exclude_none" : "exclude cvs";
}
function shippingGroup(p: ProductFull): string {
  return status(p) === "即日発送" ? "即日配送パターン" : "デフォルト配送パターン";
}
function conditionNote(p: ProductFull, type: number, target: string): string {
  const sameDay = status(p) === "即日発送";
  if (type === TYPE_IV) {
    let r = sameDay
      ? "【無料電話取付サポート・有償工事全国対応】ご相談は【0466-47-9490】まで！新品・国内正規品で安心のメーカー保証付！ゆうパックで丁寧に梱包しお届け致します。 15時までのご注文で即日発送いたします。(休業日は翌営業日に発送) 万が一の初期不良時も弊社が責任をもって迅速に対応させて頂きます。電話受付：平日月-金9時-18時"
      : "【無料電話取付サポート・有償工事全国対応】ご相談は【0466-47-9490】まで！配送はゆうパックで丁寧に梱包し迅速にお届け。新品・国内正規品で安心のメーカー保証付！万が一の初期不良時も責任をもって確実に対応させて頂きます。電話受付：平日9時-18時";
    r += LEAVE_TEXT;
    if (isFba(p, "iv", target)) {
      r = `【無料電話取付サポート・有償工事全国対応】ご相談は【0466-47-9490】まで！新品・国内正規品で安心のメーカー保証付！Amazon倉庫から迅速に発送させて頂きます。万が一の初期不良時も弊社が責任をもって丁寧に対応させて頂きます。電話受付：月-金9時-18時${LEAVE_TEXT}`;
    }
    return r;
  }
  let r = sameDay
    ? "こちらの商品は、新品・国内正規品ですので安心のメーカー保証付です。 15時までのご注文で即日発送いたします。(休業日は翌営業日に発送)配送はゆうパックを使用し、割れ物シールを貼って丁寧にお届けします。万が一不良品の場合も、責任をもって迅速に対応させて頂きます。お急ぎの場合は、9時-18時でお電話での問い合わせも受け付けております。お気軽にご相談くださいませ。"
    : "こちらの商品は、新品・国内正規品ですので安心のメーカー保証付です。配送はゆうパックを使用し割れ物シールを貼って丁寧にお届けします。万が一不良品の場合も責任をもって迅速に対応させて頂きます。お急ぎの場合は、月-金9時-18時でお電話での問い合わせも受け付けております。お気軽にご相談くださいませ。";
  r += LEAVE_TEXT_SD;
  if (isFba(p, "sd", target)) {
    r = `こちらの商品は、新品・国内正規品ですので安心のメーカー保証付です。Amazon倉庫から迅速に発送させて頂きます。万が一の初期不良時も弊社が責任をもって丁寧に対応させて頂きます。${LEAVE_TEXT_SD}`;
  }
  return r;
}

function bulletPoint1(p: ProductFull): string {
  const h = cell(p, "height");
  const h2 = cell(p, "height2");
  let s = `幅：${str(cell(p, "width"))}mm `;
  if (str(h2) !== "" && str(h) !== str(h2)) s += `／ 高さ：${str(h)}-${str(h2)}mm `;
  else s += `／ 高さ：${str(h)}mm `;
  s += `／ 重さ：${str(cell(p, "weight"))}kg `;
  const ang = angled(p);
  if (ang !== "" && ang !== "NG") {
    s += ang.includes("-") ? `／ 傾斜${ang}度までの傾斜天井に設置可能` : `／ 傾斜0-${ang}度までの傾斜天井に設置可能`;
  } else s += " ／ 傾斜天井には設置出来ません";
  return s;
}
function bulletPoint2(p: ProductFull): string {
  const f = p.fanAttrs;
  let s = "";
  if (f?.motorType === "DC") s += "静かなでパワフルDCモーター";
  else if (f?.motorType === "AC") s += "ACモーター";
  const kind = f?.lightKind ?? "";
  if (kind === "LED") s += "、LED照明タイプ";
  else if (kind === "電球型蛍光灯") s += "、電球型蛍光灯タイプ";
  else if (kind === "白熱灯") s += "、白熱灯タイプ";
  if ((f?.lightCount ?? 0) > 0) s += `、${f!.lightCount}灯`;
  const lumen = ex(p).lumenRaw as number | null;
  if (lumen != null) s += `、${vbRound(lumen)} ルーメン`;
  if ((f?.dimming ?? "") === "無段階調光") s += "、無段階調光";
  const tatami = ex(p).tatamiToRaw as number | null;
  if (tatami != null) {
    const m: Record<string, string> = {
      "3": "、明るさ3畳程度",
      "4.5": "、明るさ4.5畳程度",
      "6": "、明るさ6畳程度",
      "5.9": "、明るさ6畳まで",
      "8": "、明るさ8畳程度",
      "10": "、明るさ10畳程度",
      "12": "、明るさ12畳程度",
      "14": "、明るさ14畳程度",
    };
    s += m[String(tatami)] ?? "";
  }
  const remote = exs(p, "remoteRaw");
  if (["あり", "1ch", "2ch", "3ch", "4ch"].includes(remote)) s += "、リモコン付属";
  else if (remote === "プルSW") s += "、リモコンなし（プルスイッチタイプ）";
  else if (remote === "壁") s += "、リモコンなし（壁スイッチタイプ）";
  return s;
}
function bulletPoint3(p: ProductFull): string {
  let s = "";
  const wind = windCell(p);
  if (typeof wind === "number") {
    for (const th of [160, 130, 120, 110, 100, 90, 80, 70]) {
      if (wind >= th) {
        s += `、大風量タイプ ${th} m3/min以上`;
        break;
      }
    }
  } else if (wind === "large1") s += "大風量 ";
  if (exs(p, "rhythmRaw") === "あり") s += "、リズム回転機能";
  const b1 = p.fanAttrs?.bladeColor1 ?? "";
  const b2 = p.fanAttrs?.bladeColor2 ?? "";
  if (b1 !== "" && b2 !== "" && b1 !== b2) s += "、羽根リバーシブル";
  if (s.startsWith("、")) s = s.slice(1, 501);
  return s;
}
function bulletPoint4(p: ProductFull): string {
  if (install(p, 0) !== "") return "取り付け方法、電気工事不要の簡易取付タイプ";
  if (install(p, 1) !== "")
    return "取り付け方法、簡易取付（一部電気工事）※マンションなどに多い、引掛け埋め込みローゼットの場合、電気工事が必要になります";
  if (install(p, 2) !== "") return "取り付け方法、電気工事不要の簡易取付タイプ";
  if (install(p, 3) !== "" || install(p, 4) !== "") return "取り付け方法、電気工事が必要になります";
  return "";
}
const BULLET5 = "設置場所によっては別途補強が必要な場合がございますのでご不安であれば事前にご確認ください。";

function genericKeywords(p: ProductFull): string {
  const f = p.fanAttrs;
  let s = `${cfMaker(p, 6).replace(/_/g, " ")} `;
  s += "マンション ";
  const ang = angled(p);
  if (ang !== "" && ang !== "NG") s += "勾配天井 ";
  s += "おすすめ　おしゃれ　安い　人気　インテリア ";
  const color = p.bodyColor ?? "";
  if (color !== "") s += `${color} `;
  if (color.includes("クラシック")) s += "クラシック クラシカル アンティーク ラタン 木目 ウッド ブラウン ";
  if (color.includes("有色") || color.includes("北欧")) s += "北欧 木目 ウッド ブラウン ナチュラル ";
  const dim = f?.dimming ?? "";
  if (dim === "無段階調光") s += "無段階調光 ";
  else if (dim === "調光") s += "調光 ";
  else if (dim === "調光・光色切替" || dim === "調光・調色") s += "調光 光色 調色 ";
  const mount = f?.mountType ?? "";
  if (mount === "直付") s += "天井直付け ";
  else if (mount === "パイプ" || mount === "加工パイプ") s += "パイプ延長 吊下げ ";
  const wind = windCell(p);
  if (typeof wind === "number") {
    if (wind >= AIR_VOL_E1) s += "業務用 ";
  } else if (wind === "large1") s += "大風量 ";
  const blades = f?.bladeCount ?? 0;
  if (blades >= 2 && blades <= 8) s += `${blades}枚 羽根 `;
  s += "天井扇 扇風機 送料無料 amazon ";
  s += cfHasLightModel(p) ? "照明 灯具 " : "ファンのみ ";
  s += cfModelConcat(p);
  if (utf8Len(s) > 1000) s = cutTextUtf8(s, 1000);
  return s;
}

const COLOR_MAP: Record<string, string> = {
  ホワイト: "ホワイト", オフホワイト: "ホワイト", アイボリー: "ホワイト", アンティークアイボリー: "ホワイト",
  ブラウン: "ブラウン", ナチュラル: "ブラウン", ダークブラウン: "ブラウン", コア: "ブラウン",
  金古美: "ブロンズ", 真鍮ブロンズメッキ: "ブロンズ", 金古美メッキ: "ブロンズ", ブロンズ: "ブロンズ", ダークブロンズ: "ブロンズ",
  ブラック: "ブラック", オフブラック: "ブラック", マットブラック: "ブラック", チャコールグレー: "ブラック",
  パープルブルー: "ブルー", グリーン: "グリーン", ミントグリーン: "グリーン",
  シルバー: "シルバー", シルバーメタリック: "シルバー", メッキ: "シルバー", ニッケルメッキ仕上: "シルバー",
  クロームメッキ: "シルバー", "乳白・シルバー": "シルバー", "透明・シルバー": "シルバー",
  ゴールド: "ゴールド", 金色ヘアラインメッキ: "ゴールド", "乳白・ゴールド": "ゴールド", "透明・ゴールド": "ゴールド",
};
// 未知の色は現行 MsgBox+Stop(続行で空)
function colorMap(p: ProductFull): string {
  return COLOR_MAP[p.bodyColor ?? ""] ?? "";
}

// ImageMng(SET_IMG): メイン画像 + サブ画像8枚(取付案内画像を必ず最後に追加)。生産終了は画像なし
// 画像I10 は現行で Case 20 重複のため到達不能(既知バグ7)→ 再現しない方針だが、現行出力との一致のため I9 までで打ち切る点は同じ
const IMG = { M1: 0, M2: 1, I1: 7, I2: 8, I3: 9, I4: 10, I5: 11, I6: 12, I7: 13, I8: 14, I9: 15, I10: 16, S1: 17, S2: 18, F1: 19, F2: 20, F3: 21, R1: 22, E1: 23 };
type Images = { main: string; others: string[] };
function images(p: ProductFull): Images {
  const g: string[] = Array(9).fill("");
  if (status(p) === "生産終了") return { main: "", others: g.slice(1) };
  let n = 0;
  let last = "";
  const push = (fileName: string) => {
    last = `${IMG_URL}${cfImgFolder(fileName)}/${fileName}`;
    g[n++] = last;
  };
  const order: Array<keyof typeof IMG | "MAIN" | null> = [
    "MAIN", "M2", null, null, "I1", "I2", "F1", "F2", "F3", "S1", "S2", "R1", "E1", "I3", "I4", "I5", "I6", "I7", "I8", "I9",
  ];
  for (const key of order) {
    if (key === "MAIN") {
      const ad = str(cell(p, "amazonMainImage"));
      if (ad !== "") {
        push(ad);
        push(imageCell(p, IMG.M1));
      } else if (imageCell(p, IMG.M1) !== "") push(imageCell(p, IMG.M1));
      if ((p.fanAttrs?.mountType ?? "") === "加工パイプ") {
        last = `${IMG_URL}etc/item40cm-caution.gif`;
        g[n++] = last;
      }
    } else if (key) {
      const v = imageCell(p, IMG[key]);
      const skip = (key === "M2" && v === "ivillage_if0140L_sale.png") || (key === "S1" && v === "CUSTOM-SIZE");
      if (v !== "" && !skip) push(v);
    }
    if (n >= 8) break;
  }
  let error = false;
  const i1 = install(p, 0);
  if (i1 === "○") last = `${IMG_URL}etc/installation_01.gif`;
  else if (i1 === "hanwa_installation_05") last = `${IMG_URL}etc/hanwa_installation_05.gif`;
  else if (install(p, 1) === "○") last = `${IMG_URL}etc/installation_03.gif`;
  else if (install(p, 2) === "○") last = `${IMG_URL}etc/installation_04.gif`;
  else if (install(p, 3) === "○" || install(p, 4) === "○") last = `${IMG_URL}etc/installation_02.gif`;
  else error = true; // 現行は Stop。続行すると直前の画像URLが取付画像の位置に入り、メイン画像は "ERROR"
  g[n] = last;
  return { main: error ? "ERROR" : g[0], others: g.slice(1) };
}

// ---------- 行の組み立て(SetOverwriteCSV_amazon / SetVariation) ----------
type Row = string[]; // 0始まり(列番号-1)、長さ COL_END
const newRow = (): Row => Array(COL_END).fill("");
function put(r: Row, c: number, v: string): void {
  r[c - 1] = v;
}
function get(r: Row, c: number): string {
  return r[c - 1];
}

function writeImages(r: Row, img: Images): void {
  put(r, C.main_image_url, img.main);
  for (let i = 0; i < 8; i++) put(r, C.other_image_url1 + i, img.others[i]);
  put(r, C.swatch_image_url, "");
}

function mainRow(p: ProductFull): Row {
  const r = newRow();
  const code = sku(p);
  const st = status(p);
  put(r, C.feed_product_type, "Kitchen");
  put(r, C.item_sku, code);
  if (st === "在庫切れ" || st === "即日切れ") {
    put(r, C.quantity, quantity(p, "iv", code));
    put(r, C.update_delete, updateDelete(p, "iv", code));
    put(r, C.merchant_release_date, merchantReleaseDate(p));
    put(r, C.restock_date, restockDate(p));
    put(r, C.merchant_shipping_group_name, shippingGroup(p));
    put(r, C.fulfillment_latency, fulfillmentLatency(p, code));
    return r;
  }
  put(r, C.external_product_id, productId(p, code));
  put(r, C.external_product_id_type, productIdType(p, code));
  put(r, C.item_name, itemName(p));
  put(r, C.recommended_browse_nodes, "2133986051");
  put(r, C.part_number, partNumber(p));
  put(r, C.quantity, quantity(p, "iv", code));
  put(r, C.standard_price, standardPrice(p));
  writeImages(r, images(p));
  put(r, C.update_delete, updateDelete(p, "iv", code));
  put(r, C.brand_name, brand(p));
  put(r, C.model, model(p));
  put(r, C.product_description, description(p));
  put(r, C.manufacturer, manufacturer(p));
  put(r, C.color_map, colorMap(p));
  put(r, C.bullet_point1, bulletPoint1(p));
  put(r, C.bullet_point1 + 1, bulletPoint2(p));
  put(r, C.bullet_point1 + 2, bulletPoint3(p));
  put(r, C.bullet_point1 + 3, bulletPoint4(p));
  put(r, C.bullet_point1 + 4, BULLET5);
  put(r, C.generic_keywords, genericKeywords(p));
  put(r, C.fulfillment_center_id, fulfillmentCenterId(p, "iv", code));
  put(r, C.batteries_required, "false");
  put(r, C.are_batteries_included, "false");
  put(r, C.supplier_declared_dg_hz_regulation1, "not_applicable");
  put(r, C.fulfillment_latency, fulfillmentLatency(p, code));
  put(r, C.merchant_shipping_group_name, shippingGroup(p));
  put(r, C.optional_payment_type_exclusion, paymentExclusion(p));
  put(r, C.merchant_release_date, merchantReleaseDate(p));
  put(r, C.list_price, listPrice(p));
  put(r, C.restock_date, restockDate(p));
  put(r, C.max_order_quantity, "9");
  put(r, C.condition_type, "New");
  put(r, C.condition_note, conditionNote(p, TYPE_IV, code));
  put(r, C.standard_price_points_percent, "1");
  put(r, C.sale_price, isSale(p) ? itemPrice(p) : "");
  put(r, C.sale_from_date, isSale(p) ? vbDateIso(cell(p, "reserveStart")) : "");
  put(r, C.sale_price_points_percent, "0");
  put(r, C.sale_end_date, isSale(p) ? vbDateIso(cell(p, "reserveEnd")) : "");
  return r;
}

// SD(相乗り)行: IV行を写して SKU に「SD-」、在庫・更新区分・FCは SD の ASIN一覧で引き直す
function sdMainRow(p: ProductFull, iv: Row): Row {
  const r = [...iv];
  const target = `SD-${get(iv, C.item_sku)}`;
  put(r, C.item_sku, target);
  put(r, C.quantity, quantity(p, "sd", target));
  put(r, C.update_delete, updateDelete(p, "sd", target));
  put(r, C.fulfillment_center_id, fulfillmentCenterId(p, "sd", target));
  const st = status(p);
  if (st === "" || st === "即日発送") {
    // 通常・即日: 商品情報を空にして出品情報だけ PartialUpdate
    for (let c = C.item_name; c <= C.main_image_url; c++) put(r, c, "");
    for (let c = C.other_image_url1; c <= C.variation_theme; c++) put(r, c, "");
    put(r, C.condition_note, conditionNote(p, TYPE_SD, target));
    put(r, C.delivery_schedule_group_id, "");
    put(r, C.update_delete, "PartialUpdate");
  }
  return r;
}

function childRow(p: ProductFull, i: number): Row {
  const r = newRow();
  const code = sku(p);
  const target = `${code}v${i}`;
  const st = status(p);
  put(r, C.item_sku, target);
  if (st === "在庫切れ" || st === "即日切れ") {
    // 現行は A列(商品タイプ)を書かないため、この行は後続商品の上書き・空行削除で消える
    put(r, C.quantity, quantity(p, "iv", target));
    put(r, C.update_delete, updateDelete(p, "iv", target));
    put(r, C.merchant_release_date, merchantReleaseDate(p));
    put(r, C.restock_date, restockDate(p));
    put(r, C.merchant_shipping_group_name, shippingGroup(p));
    return r;
  }
  put(r, C.item_name, `${variationOpt(p, i)} ${itemName(p)}`);
  put(r, C.external_product_id, productId(p, target));
  put(r, C.external_product_id_type, productIdType(p, target));
  put(r, C.brand_name, brand(p));
  put(r, C.manufacturer, manufacturer(p));
  put(r, C.feed_product_type, "Kitchen");
  put(r, C.part_number, partNumber(p));
  put(r, C.product_description, description(p));
  put(r, C.model, model(p));
  put(r, C.update_delete, updateDelete(p, "iv", target));
  put(r, C.quantity, quantity(p, "iv", target));
  // バリエーション別納期追加: リードタイム(文字列) + 追加納期セル
  const lat = fulfillmentLatency(p, target);
  const leads = cells(p).variationLead;
  const add = Array.isArray(leads) ? (leads[i - 1] as Raw) : null;
  put(r, C.fulfillment_latency, lat === "" && (add == null || add === "") ? "" : vbNum(num(lat) + num(add)));
  put(r, C.standard_price, standardPrice(p));
  put(r, C.condition_type, "New");
  put(r, C.condition_note, conditionNote(p, TYPE_IV, target));
  put(r, C.merchant_release_date, merchantReleaseDate(p));
  put(r, C.list_price, listPrice(p));
  put(r, C.optional_payment_type_exclusion, paymentExclusion(p));
  put(r, C.sale_price, isSale(p) ? itemPrice(p) : "");
  put(r, C.sale_from_date, isSale(p) ? vbDateIso(cell(p, "reserveStart")) : "");
  put(r, C.sale_end_date, isSale(p) ? vbDateIso(cell(p, "reserveEnd")) : "");
  put(r, C.restock_date, restockDate(p));
  put(r, C.max_order_quantity, "9");
  put(r, C.merchant_shipping_group_name, shippingGroup(p));
  put(r, C.bullet_point1, bulletPoint1(p));
  put(r, C.bullet_point1 + 1, bulletPoint2(p));
  put(r, C.bullet_point1 + 2, bulletPoint3(p));
  put(r, C.bullet_point1 + 3, bulletPoint4(p));
  put(r, C.bullet_point1 + 4, BULLET5);
  put(r, C.recommended_browse_nodes, "2133986051");
  writeImages(r, images(p));
  put(r, C.fulfillment_center_id, fulfillmentCenterId(p, "iv", target));
  put(r, C.parent_child, "child");
  put(r, C.parent_sku, `${code}v0`);
  put(r, C.relationship_type, "Variation");
  put(r, C.variation_theme, "color");
  put(r, C.color_name, `${axis(p)}：${variationOpt(p, i)}`);
  put(r, C.color_map, colorMap(p));
  put(r, C.are_batteries_included, "false");
  put(r, C.batteries_required, "false");
  put(r, C.supplier_declared_dg_hz_regulation1, "not_applicable");
  return r;
}

// 親行: IV のメイン行(シートに書いた値)から必要な列だけ写す
const PARENT_COPY = [
  "item_name", "brand_name", "manufacturer", "part_number", "product_description", "update_delete", "restock_date",
  "max_order_quantity", "offering_can_be_gift_messaged", "offering_can_be_giftwrapped", "merchant_shipping_group_name",
  "distribution_designation", "recommended_browse_nodes", "main_image_url", "fulfillment_center_id", "package_length",
  "package_width", "package_height", "package_weight", "package_weight_unit_of_measure", "country_of_origin", "color_name",
  "color_map", "size_name", "size_map", "wattage", "are_batteries_included", "batteries_required",
  "supplier_declared_dg_hz_regulation1",
  "bullet_point1", "bullet_point2", "bullet_point3", "bullet_point4", "bullet_point5",
] as const;
function parentRow(main: Row): Row {
  const r = newRow();
  put(r, C.feed_product_type, get(main, C.feed_product_type));
  put(r, C.item_sku, `${get(main, C.item_sku)}v0`);
  for (const key of PARENT_COPY) put(r, col(key), get(main, col(key)));
  // 防カビ加工〜刃渡りの長さの単位(テンプレート外。常に空)
  for (let c = C.material_type_free; c <= C.blade_length_unit_of_measure; c++) put(r, c, get(main, c));
  put(r, C.parent_child, "parent");
  put(r, C.variation_theme, "color");
  return r;
}

function sdChildRow(p: ProductFull, child: Row): Row | null {
  const st = status(p);
  const r = [...child];
  const target = `SD-${get(child, C.item_sku)}`;
  if (st === "在庫切れ" || st === "即日切れ" || st === "生産終了") {
    // IV子行をそのまま(在庫・更新区分は IV の値のまま。現行どおり)
    put(r, C.item_sku, target);
    return r;
  }
  if (st === "" || st === "即日発送") {
    put(r, C.item_sku, target);
    for (let c = C.brand_name; c <= C.manufacturer; c++) put(r, c, "");
    for (let c = C.main_image_url; c <= C.variation_theme; c++) put(r, c, "");
    for (let c = C.external_product_id; c <= C.product_description; c++) {
      if (c !== C.external_product_id && c !== C.external_product_id_type) put(r, c, "");
    }
    put(r, C.condition_note, conditionNote(p, TYPE_SD, target));
    put(r, C.delivery_schedule_group_id, "");
    put(r, C.update_delete, "PartialUpdate");
    return r;
  }
  return null;
}

// 出力対象の判定(SetSelectRangeCSV_amazon のループ)
function isTarget(p: ProductFull): boolean {
  if (str(cell(p, "registerFlag")) !== "○") return false;
  const del = str(ex(p).amazonDeleteFlag as Raw);
  if (del === "×") return false;
  const pri = priority(p);
  const st = status(p);
  if (pri !== "△" && pri !== "×" && st !== "生産終了") return true;
  if (pri !== "△" && st === "生産終了") return true; // 生産終了の削除更新(確認ダイアログは「はい」扱い)
  return false; // △単体商品 / 優先度×の販売中(現行は Stop)
}

function variationCount(p: ProductFull): number {
  if (axis(p) === "") return 0;
  let n = 0;
  for (let i = 1; i <= 3; i++) if (variationOpt(p, i) !== "") n = i;
  return n;
}

// ASIN一覧の重複(CheckAsinOverlapIV/SD)。重複があれば現行どおり中止
function checkAsinOverlap(products: ProductFull[]): void {
  const dups: string[] = [];
  for (const p of products) {
    const a = (ex(p).amazonAsin ?? {}) as Record<string, Record<string, Asin>>;
    for (const kind of ["iv", "sd"] as const) {
      for (const [k, v] of Object.entries(a[kind] ?? {})) if (v.dup) dups.push(`${kind === "iv" ? "Amazon(IV-ASIN)" : "Amazon(SD-ASIN)"} ${k}`);
    }
  }
  if (dups.length > 0) {
    throw Object.assign(new Error(`ASIN一覧シートに重複データがあります。見直し＆最新データに更新してください: ${dups.join(", ")}`), { status: 400 });
  }
}

function buildRows(products: ProductFull[]): { iv: Row[]; sd: Row[] } {
  checkAsinOverlap(products);
  const iv: Row[] = [];
  const sd: Row[] = [];
  for (const p of products) {
    if (!isTarget(p)) continue;
    const main = mainRow(p);
    const ivBlock: Row[] = [main];
    const sdBlock: Row[] = [sdMainRow(p, main)];
    const n = variationCount(p);
    if (n > 0) {
      for (let i = n; i >= 1; i--) {
        const child = childRow(p, i);
        ivBlock[i] = child;
        const sdc = sdChildRow(p, child);
        if (sdc) sdBlock[i - 1] = sdc;
      }
      ivBlock[0] = parentRow(main);
    }
    iv.push(...ivBlock);
    sd.push(...sdBlock);
  }
  // A列(商品タイプ)が空の行は現行では次商品に上書きされるか RedundantLineDeletion で消える
  const finish = (rows: Row[]) => rows.filter((r) => get(r, C.feed_product_type) !== "").map((r) => r.slice(0, AMAZON_HEADER.length).map((v, i) => excelCell(v, i + 1)));
  return { iv: finish(iv), sd: finish(sd) };
}

const FORMAT = { delimiter: "\t", quote: "auto", charset: "SHIFT_JIS", lineEnd: "\r\n", extension: "txt" } as const;
const PREAMBLE = [AMAZON_TEMPLATE_ROW1, AMAZON_TEMPLATE_ROW2];
// ファイル名: amazon-IV更新用_yyyymmdd_hhmm.txt(現行どおり分割なし)
const ymdHm = (stamp: string) => `${stamp.slice(0, 8)}_${stamp.slice(8, 12)}`;

export const AMAZON_FILE_SPECS: MallFileSpec[] = [
  {
    channel: "amazon",
    fileType: "amazon_iv",
    label: "Amazon IV(自社)更新用",
    book: "CF",
    format: FORMAT,
    fileName: (stamp) => `amazon-IV更新用_${ymdHm(stamp)}`,
    header: AMAZON_HEADER,
    preamble: PREAMBLE,
    generate: (products) => buildRows(products).iv,
  },
  {
    channel: "amazon",
    fileType: "amazon_sd",
    label: "Amazon SD(相乗り)更新用",
    book: "CF",
    format: FORMAT,
    fileName: (stamp) => `amazon-SD更新用_${ymdHm(stamp)}`,
    header: AMAZON_HEADER,
    preamble: PREAMBLE,
    generate: (products) => buildRows(products).sd,
  },
];

export const AMAZON_SET_SPECS: MallSetSpec[] = [
  {
    channel: "amazon",
    fileType: "csv_amazon",
    label: "CSV_Amazon(IV・SD更新用)",
    book: "CF",
    members: ["amazon_iv", "amazon_sd"],
    zipName: (stamp) => `amazon更新用_${ymdHm(stamp)}`,
  },
];
