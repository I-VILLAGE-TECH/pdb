// Yahoo 商品データ(CF: data_add 54列)・在庫・削除の行生成
// 現行VBA ceilingfan/modules/Yahoo作成用.bas(SetSelectRangeCSV_yahoo / SetOverwriteCSV_Yahoo / Set*)と、
// そこから呼ばれる Shopserve用.bas の共通関数(メイン紹介文 / サブ紹介文1 / SetInstallMov(YAHOO, YAHOO_SMP))を再現する。
// シートのセル値は取込済みの項目(products / product_fan_attrs / set_components / extra)から読む(excelExtract.ts の extractCf)。
import type { ProductFull } from "../mallCsv.js";
import { cfHasLightModel, cfMaker, cfModelConcat } from "../fsCfGoods.js";
import { cfFunctionIcons, cfPageTitle } from "../fsCfComments.js";

const NL = "\r\n"; // vbNewLine

// 現行の定数(Common.bas)
const AIR_VOL_E1 = 70;
const SLIM_TYPE_HEIGHT = 350;
const SMALL_TYPE_WIDTH = 900;
const LIGHT_WEIGHT_TYPE1 = 5;
const LIGHT_WEIGHT_TYPE2 = 7;
// 電動昇降機: 優先度・入荷予定に関係なく更新対象(SetSelectRangeCSV_yahoo)/カテゴリ差し替え(SetPath)
const LIFTER_UPDATE_CODES = new Set(["OXO003", "OXO004", "OXO006", "OXO007"]);

export const YAHOO_CF_ADD_HEADER = [
  "path", "name", "code", "sub-code", "original-price", "price", "sale-price", "options", "headline", "caption",
  "abstract", "explanation", "additional1", "additional2", "additional3", "relevant-links", "ship-weight", "taxable",
  "release-date", "temporary-point-term", "point-code", "meta-desc", "display", "template", "sale-period-start",
  "sale-period-end", "sale-limit", "sp-code", "brand-code", "yahoo-product-code", "product-code", "jan", "delivery",
  "astk-code", "condition", "product-category", "spec1", "spec2", "spec3", "spec4", "spec5", "spec6", "spec7", "spec8",
  "spec9", "spec10", "sort", "sp-additional", "sort_priority", "original-price-evidence", "lead-time-instock",
  "lead-time-outstock", "keep-stock", "postage-set",
];

// ---------------- セル読み出し ----------------
function extra(p: ProductFull): Record<string, unknown> {
  return (p.extra ?? {}) as Record<string, unknown>;
}
function exs(p: ProductFull, key: string): string {
  const v = extra(p)[key];
  return v == null ? "" : String(v);
}
function exNum(p: ProductFull, key: string): number | null {
  const v = extra(p)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function exCell(p: ProductFull, key: string): number | string | null {
  const v = extra(p)[key];
  return typeof v === "number" || typeof v === "string" ? v : null;
}
function component(p: ProductFull, role: string): string {
  return p.setComponents.find((c) => c.role === role)?.componentModel ?? "";
}
function installNotes(p: ProductFull): Record<string, unknown> {
  return (p.fanAttrs?.installNotes ?? {}) as Record<string, unknown>;
}
function note(p: ProductFull, key: string): string {
  const v = installNotes(p)[key];
  return v == null ? "" : String(v);
}
// 数値セルの VBA 文字列化(有効15桁)
function vbNum(n: number): string {
  return String(Number(n.toPrecision(15)));
}
// VBA Round / CInt(偶数丸め)
function vbRound(x: number, digits = 0): number {
  const m = 10 ** digits;
  const v = Number((x * m).toPrecision(15));
  const f = Math.floor(v);
  const d = v - f;
  const r = d > 0.5 ? f + 1 : d < 0.5 ? f : f % 2 === 0 ? f : f + 1;
  return r / m;
}
// Shift_JIS 相当のバイト長(LenByte)
function sjisLen(s: string): number {
  let n = 0;
  for (const ch of s) n += ch.charCodeAt(0) > 0xff ? 2 : 1;
  return n;
}

const arrival = (p: ProductFull) => p.statusNote ?? ""; // 入荷予定
const priority = (p: ProductFull) => exs(p, "priority"); // 商品登録優先度
const makerCode = (p: ProductFull) => p.maker?.makerCode ?? "";
const isListed = (p: ProductFull) => p.variations.some((v) => v.listed); // 商品登録フラグ○
const widthNum = (p: ProductFull) => exNum(p, "widthRaw") ?? p.widthMm ?? 0; // 空セルは0
const heightNum = (p: ProductFull) => exNum(p, "heightRaw") ?? p.heightMm ?? 0;
const weightNum = (p: ProductFull) => exNum(p, "weightRaw") ?? (p.weightKg == null ? 0 : Number(p.weightKg));
const arrivalText = (p: ProductFull) => exs(p, "arrivalText"); // 入荷待ち文言
const variationAxis = (p: ProductFull) => exs(p, "variationAxisRaw");
function variationOpts(p: ProductFull): [string, string, string] {
  const raw = extra(p).variationOptsRaw;
  const a = Array.isArray(raw) ? raw : [];
  return [0, 1, 2].map((i) => (a[i] == null ? "" : String(a[i]))) as [string, string, string];
}
// 画像データ M1〜E1 の生セル(INPUT_COL 112〜135 相当)
const IMG = { M1: 0, M2: 1, FHtml1: 2, MV_YA: 5, I1: 7, S1: 17, F1: 19, R1: 22, E1: 23 } as const;
function imageCells(p: ProductFull): string[] {
  const raw = extra(p).cfImageCells;
  const a = Array.isArray(raw) ? raw : [];
  return Array.from({ length: 24 }, (_, i) => (a[i] == null ? "" : String(a[i])));
}
// 追加納期(バリエーション1〜3)。空は0
function addLeadTime(p: ProductFull, no: number): number {
  const v = p.variations.find((x) => x.variationNo === no)?.additionalLeadTime;
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
const normalLeadTimeCell = (p: ProductFull) => p.shippingLeadTime ?? ""; // 通常納期
// 日付セル(取込で ISO 文字列になる)なら Format(.., "m月d日頃の予定")
function arrivalDateText(text: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})/.exec(text);
  if (m) {
    const d = new Date(new Date(text).getTime() + 9 * 3600 * 1000); // JST の日付
    return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日頃の予定`;
  }
  const m2 = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(text);
  if (m2) return `${Number(m2[2])}月${Number(m2[3])}日頃の予定`;
  return null;
}

// ---------------- 対象判定(SetSelectRangeCSV_yahoo) ----------------
// ○登録 かつ 優先度△/×以外 かつ 生産終了以外、または ○登録の電動昇降機4機種 → 商品・在庫
export function yahooCfIsAddTarget(p: ProductFull): boolean {
  if (!isListed(p)) return false;
  if (priority(p) !== "△" && priority(p) !== "×" && arrival(p) !== "生産終了") return true;
  return LIFTER_UPDATE_CODES.has(p.productCode);
}
// それ以外で入荷予定=生産終了 → 削除(現行は登録フラグを見ない。確認ダイアログは「はい」とみなす)
export function yahooCfIsDeleteTarget(p: ProductFull): boolean {
  return !yahooCfIsAddTarget(p) && arrival(p) === "生産終了";
}

// 在庫(SetQuantityCSV_Yahoo): 常に99。バリエーション項目名があれば選択肢ごとに sub-code=IDv1..v3
export function yahooCfQuantityRows(p: ProductFull): string[][] {
  const code = p.productCode;
  const first = [code, "", "99", "", ""];
  const rows = [first];
  if (variationAxis(p) !== "") {
    const [o1, o2, o3] = variationOpts(p);
    if (o1 !== "") first[1] = `${code}v1`;
    if (o2 !== "") rows.push([code, `${code}v2`, "99", "", ""]);
    if (o3 !== "") rows.push([code, `${code}v3`, "99", "", ""]);
  }
  return rows;
}

// ---------------- 文字列変換 ----------------
// CovURLandCase: URLを置換し、置換後URLに続くファイル名(次の " まで)を小文字化(文字列全体の同じ部分を Replace)
function covUrlAndCase(input: string, src: string, dst: string): string {
  let s = input.split(src).join(dst);
  let pos = 0;
  for (;;) {
    const at = s.indexOf(dst, pos);
    if (at < 0) break;
    pos = at + dst.length;
    const q = s.indexOf('"', pos);
    if (q < 0) break;
    const tmp = s.slice(pos, q);
    if (tmp) s = s.split(tmp).join(tmp.toLowerCase());
  }
  return s;
}

// ---------------- 各列 ----------------
// 商品カテゴリ(SetPath)
function setPath(p: ProductFull): string {
  const light = cfHasLightModel(p);
  let sLight = light ? "照明あり" : "照明なし";
  const kind = p.fanAttrs?.colorCategory ?? ""; // カラー種別
  const types = kind === "クラシック" ? [":クラシック"] : kind.includes("クラシック") ? [":クラシック", ":モダン"] : [":モダン"];
  const mount = p.fanAttrs?.mountType ?? ""; // 直付パイプ
  const h = heightNum(p);
  const heights: string[] = [];
  if (mount === "直付") heights.push(":普通天井");
  if ((mount === "パイプ" || mount === "加工パイプ") && h < 1000) heights.push(":ロフト付き");
  if ((mount === "パイプ" || mount === "加工パイプ") && 1000 <= h) heights.push(":1-2F吹き抜け");
  const sWidth = widthNum(p) < 1000 ? ":小型サイズ" : ":普通サイズ";
  let out = sLight + NL;
  for (const hh of heights) {
    out += sLight + hh + NL;
    for (const t of types) {
      out += sLight + hh + t + NL;
      out += sLight + hh + t + sWidth + NL;
    }
  }
  const brand = cfMaker(p, 13);
  sLight = light ? "照明あり" : "ファンのみ";
  if (LIFTER_UPDATE_CODES.has(p.productCode)) return `${brand}${NL}電動昇降機${NL}`;
  return `${out}${brand}${NL}${brand}:${sLight}${NL}`;
}

// 商品名(SetName)
function setName(p: ProductFull): string {
  const f = p.fanAttrs;
  const light = cfHasLightModel(p);
  const eos = arrival(p) === "生産終了";
  let s = "";
  if (arrival(p) === "即日発送") s += "即日発送 ";
  if (!eos && priority(p) !== "△" && makerCode(p) !== "IM") s += "長期保証 ";
  if (makerCode(p) === "P") s += `${cfModelConcat(p)} `;
  s += exs(p, "productNameRaw");
  if (p.priceControlled) s += `${cfModelConcat(p)} `;
  if (!eos && priority(p) !== "△") {
    if (heightNum(p) < SLIM_TYPE_HEIGHT) s += "薄型 ";
    if (widthNum(p) < SMALL_TYPE_WIDTH) s += "小型 ";
    const w = weightNum(p);
    if ((w <= LIGHT_WEIGHT_TYPE1 && !light) || (w <= LIGHT_WEIGHT_TYPE2 && light)) s += "軽量 ";
    if ((f?.lightKind ?? "") === "LED" && light) s += "LED ";
    if (f?.lightCount != null) s += `${f.lightCount}灯 `;
    const tatami = exNum(p, "tatamiToRaw") ?? f?.tatamiTo ?? null;
    if (tatami != null && light) {
      if (tatami === 8) s += "明るさ8畳 ";
      else if (tatami === 10) s += "明るい10畳 ";
      else if (tatami === 12) s += "明るい12畳 ";
      else if (tatami === 14) s += "明るい14畳 ";
    }
    const dim = f?.dimming ?? "";
    if (light) {
      if (dim === "調光" || dim === "無段階調光") s += "調光 ";
      else if (dim === "調光・光色切替") s += "調光・光色切替 ";
      else if (dim === "調光・調色") s += "調光・調色 ";
    }
    if ((f?.motorType ?? "") === "DC") s += "DCモーター ";
    const vol = exCell(p, "windVolumeCell");
    if (typeof vol === "number") {
      if (AIR_VOL_E1 <= vol) s += "大風量 ";
    } else if (vol === "large1") s += "大風量 ";
    if (exs(p, "remoteRaw") === "プルSW") s += "プルスイッチ ";
    const ang = exCell(p, "angledRaw");
    if (ang != null && String(ang) !== "" && String(ang) !== "NG") s += "吹き抜け 傾斜天井 ";
  }
  s += `${cfMaker(p, 1)} `;
  const color = f?.colorCategory ?? "";
  if (color.includes("ホワイト")) s += "ホワイト ";
  else if (color.includes("アイボリー")) s += "アイボリー ";
  else if (color.includes("クラシック")) s += "クラシック ";
  if (priority(p) !== "△" && !light) s += "シーリングファン ";
  else if (priority(p) !== "△" && light) s += "シーリングファン ライト ";
  else s += "シーリングファン オプション ";
  if (s.endsWith(" ")) s = s.slice(0, -1);
  const id = exs(p, "nameId") || p.productCode;
  const id2 = /^[0-9]$/.test(id.charAt(3)) ? `${id.slice(0, 3)}-${id.slice(3)}` : `${id.slice(0, 4)}-${id.slice(4)}`;
  s += ` ${id2}`;
  if (eos) s += " 生産終了品";
  // 150バイト以内になるまで決められた順に語を削る
  const cuts: Array<[string, string]> = [
    [" 吹き抜け", ""], [" 軽量", ""], [" 明るい", ""], [" ホワイト", ""], [" 明るさ8畳", ""], [" 簡易取付", ""],
    ["Modern Collection ", ""], ["クラシック ", ""], [" + ", "+"],
    ["+LLD4000MLCE1 / LLD4000MVCE1 / LLD4000MNCE1", ""], ["+LLD3020MLCE1 / LLD3020MVCE1 / LLD3020MNCE1", ""],
    ["(拡散)", ""], ["(集光)", ""], ["4灯灯具", ""], ["Ra90", ""], ["[美ルック]", ""], ["JAVALO ELF ", ""],
    ["小型 ", ""], ["薄型 ", ""], ["1灯 ", ""],
  ];
  for (const [from, to] of cuts) {
    if (sjisLen(s) <= 150) break;
    s = s.split(from).join(to);
  }
  return s;
}

function setSubCode(p: ProductFull): string {
  const axis = variationAxis(p);
  if (axis === "") return "";
  const [o1, o2, o3] = variationOpts(p);
  const code = p.productCode;
  let s = `${axis}:${o1}=${code}v1&${axis}:${o2}=${code}v2`;
  if (o3 !== "") s += `&${axis}:${o3}=${code}v3`;
  return s;
}

// 定価: "O" はオープン価格で0
function setOriginalPrice(p: ProductFull): string {
  const raw = exs(p, "listPriceRaw");
  if (raw === "O") return "0";
  const n = Number(raw);
  if (raw !== "" && Number.isFinite(n) && n > 0) return vbNum(n);
  return p.listPriceInTax != null && p.listPriceInTax > 0 ? String(p.listPriceInTax) : "";
}
const setPrice = (p: ProductFull) => (p.sellingPrice == null ? "" : String(p.sellingPrice));

function lightColorId(opt: string): string {
  if (opt.includes("電球色")) return "39";
  if (opt.includes("昼白色")) return "38";
  if (opt.includes("昼光色")) return "37";
  if (opt.includes("温白色")) return "224756";
  if (opt.includes("白色")) return "6066";
  return ""; // 現行は停止(新しい色合い)
}
// 工事希望+バリエーション(SetOptions)
function setOptions(p: ProductFull): string {
  let s =
    "全国対応可能な専門店の取付工事について A：お客様ご自身で取付 B：ファズーに工事依頼　見積希望 C：ファズーに工事依頼　相談済 D：別の工事店を手配して取付" +
    NL + NL;
  const axis = variationAxis(p);
  if (axis === "") return s;
  const [o1, o2, o3] = variationOpts(p);
  if (axis === "照明の色合") {
    s += "照明の色合|10| ";
    s += `${o1}|${lightColorId(o1)}| `;
    s += `${o2}|${lightColorId(o2)}| `;
    if (o3 !== "") s += `${o3}|${lightColorId(o3)}| `;
  } else {
    // 現行は照明の色合以外のバリエーションで工事希望文言を上書きしてしまう(再現)
    s = `${axis} ${o1} ${o2} `;
    if (o3 !== "") s += `${o3} `;
  }
  return s;
}

// キャッチコピー(SetHeadline)
function setHeadline(p: ProductFull): string {
  let s = "";
  const lPrice = vbRound(Number(setOriginalPrice(p) || 0));
  const lSales = vbRound(Number(setPrice(p) || 0));
  if (lPrice === lSales) {
    // 定価販売
  } else if (0 < lPrice) {
    const off = vbRound((1 - lSales / lPrice) * 100, 1);
    s += `${vbNum(off)}%OFF `;
  }
  const color = p.fanAttrs?.colorCategory ?? "";
  if (color.includes("北欧")) s += "北欧 カフェ 人気 おしゃれ インテリア ファン";
  else if (color.includes("クラシック")) s += "アジアン カフェ 人気 おしゃれ インテリア ファン";
  else s += "カフェ 人気 おしゃれ インテリア ファン";
  return s;
}

const PIC = "https://www.fazoo.biz/pic-labo/";
const YA_MAXW = '" max-width="100%'; // Yahooのみ画像に付与(後で style へ変換)

// メイン紹介文(lRow, YAHOO)
function mainIntro(p: ProductFull): string {
  let s = "";
  const main1 = p.comment ?? ""; // メイン紹介文1(個別紹介文)
  const cells = imageCells(p);
  if (main1 !== "") {
    s = main1;
  } else if (priority(p) !== "△") {
    const alt = cfPageTitle(p);
    const st = arrival(p);
    const wait = arrivalText(p);
    if (st === "即日発送") {
      s = `<img src="${PIC}shipping_12.gif" alt="15時までにご注文いただければ即日発送致します。"><br>${NL}<br>${NL}`;
    } else if ((st === "在庫切れ" || st === "即日切れ") && wait !== "") {
      s = `<img src="${PIC}shopping_reserve1.gif" alt="入荷待ち予約購入・受付中"><br>${NL}`;
      const dateText = arrivalDateText(wait) ?? wait;
      if (wait === "未定") s += `<br>${NL}`;
      else s += `<span class="center2">こちらの商品は、『<span class="red2">${dateText}</span>』でございます。</span>${NL}<br>${NL}`;
    } else if (st === "予約販売") {
      s = `<img src="${PIC}shopping_reserve0.gif" alt="先行予約購入・受付中"><br>${NL}`;
      let dateText = arrivalDateText(wait) ?? "";
      if (dateText === "" && exNum(p, "identNo") === 1 && wait !== "") dateText = wait;
      if (wait === "未定") s += `<br>${NL}`;
      else s += `<span class="center2">こちらの商品は、『<span class="red2">${dateText}</span>』でございます。</span>${NL}<br>${NL}`;
    }
    // メーカーロゴ
    s += `<span class="title_text">■Manufacturer</span><br>${NL}`;
    s += `<img src="${PIC}${cfMaker(p, 12)}">`;
    if (p.countryOfOrigin === "Japan") s += `<img src="${PIC}madeinjapan-cf_01.jpg" alt="信頼の国内生産品" class="medalbadge">`;
    if (p.goodDesignYear === 2015) s += `<img src="${PIC}gooddesignaward2015_01.gif" alt="グッドデザイン賞2015受賞商品" class="medalbadge">`;
    s += `<br>${NL}<br>${NL}`;
    // メイン画像1 + スペック
    s += `<span class="title_text">■MAIN IMAGE</span><br>${NL}`;
    s += `<img src="${PIC}${cells[IMG.M1]}${YA_MAXW}" alt="${alt}"><br>${NL}`;
    const h = heightNum(p);
    const h2 = p.height2Mm;
    s += `<span class="title_text">幅：${vbNum(widthNum(p))}`;
    if (h2 != null && h !== h2) s += `mm ／ 高さ：${vbNum(h)}-${h2}`;
    else s += `mm ／ 高さ：${p.heightMm == null && exNum(p, "heightRaw") == null ? "" : vbNum(h)}`;
    const blade = p.fanAttrs?.heightToBladeMm;
    if (blade != null) s += `mm ／ 羽根上：約${blade}mm<br>${NL}`;
    else s += "mm ／ ";
    s += `重さ：${exNum(p, "weightRaw") != null || p.weightKg != null ? vbNum(weightNum(p)) : ""}kg`;
    const ang = exCell(p, "angledRaw");
    const angS = ang == null ? "" : typeof ang === "number" ? vbNum(ang) : ang;
    if (angS !== "" && angS !== "NG") {
      if (angS.includes("-")) s += ` ／ 傾斜${angS}度<br>`;
      else s += ` ／ 傾斜0-${angS}度<br>`;
    } else s += ` ／ 傾斜不可<br>${NL}`;
    const vol = exCell(p, "windVolumeCell");
    if (vol != null && vol !== "" && Number.isFinite(Number(vol))) s += `風量：${typeof vol === "number" ? vbNum(vol) : vol}m<sup>3</sup>/min ／ `;
    else s += "風量：データなし ／ ";
    const spd = exCell(p, "windSpeedCell");
    if (spd != null && spd !== "") {
      const n = Number(spd);
      const x10 = Number((n * 10).toPrecision(15));
      s += `風速：${Math.trunc(x10) === x10 ? vbRound(n, 1).toFixed(1) : vbFormat2(n)}m/sec ／ `;
    } else s += "風速：データなし ／ ";
    const rpm = p.fanAttrs?.rotationSpeed;
    s += rpm != null ? `回転数：${rpm}rpm<br>${NL}` : `回転数：データなし<br>${NL}`;
    const modelCount = [p.modelNumber, ...["FAN", "LIGHT", "PIPE", "FLANGE", "REMOTE", "BLADE", "OPTION"].map((r) => component(p, r))].filter(Boolean).length;
    if (1 < modelCount) {
      s += `<br>${NL}<br>${NL}こちらのシーリングファンは上記の写真どおりのセット商品です。<br>${NL}取り付けの際に必要な部品は、すべて同梱されております。<br>${NL}`;
    }
    s += `</span>${NL}<br>${NL}<br>${NL}`;
    if (cells[IMG.M2] !== "") s += `<img src="${PIC}${cells[IMG.M2]}${YA_MAXW}" alt="${alt}"><br>${NL}<br>${NL}<br>${NL}`;
    // 機能アイコン
    s += `<span class="title_text">■Feature　商品特徴</span><br>${NL}${cfFunctionIcons(p)}<br>${NL}<br>${NL}`;
    if (p.fanAttrs?.mountType === "加工パイプ") {
      s += `<img src="${PIC}item40cm-caution.gif" alt="fazooオリジナル延長パイプについて"><br>${NL}<br>${NL}`;
    }
    const light = cfHasLightModel(p);
    if (cells[IMG.MV_YA] !== "") s += cells[IMG.MV_YA] + NL;
    if (cells[IMG.FHtml1] !== "") s += `${cells[IMG.FHtml1]}<br>${NL}<br>${NL}`;
    for (let i = 0; i < 10; i++) {
      const fn = cells[IMG.I1 + i];
      if (fn !== "") s += `<img src="${PIC}${fn}${YA_MAXW}" alt="${alt}"><br>${NL}<br>${NL}<br>${NL}`;
    }
    const jirei = exs(p, "exampleUrlRaw");
    if (jirei !== "") {
      s += `<div align="center">${NL}<a href="https://www.fazoo.biz/example/${jirei}/" target="_blank">${NL}`;
      s += `<img src="${PIC}jirei.gif" alt="事例写真をもっと見る" class="jirei01">${NL}</a>${NL}</div>${NL}<br>${NL}<br>${NL}`;
    }
    let sizeTitle = false;
    for (let i = 0; i < 2; i++) {
      const fn = cells[IMG.S1 + i];
      if (fn === "CUSTOM-SIZE") {
        // 幅・高さ・羽根の高さのいずれかが空なら現行は停止(Stop)。再開するとサイズ欄なしで続行されるため、何も出さない
        const hasW = exNum(p, "widthRaw") != null || p.widthMm != null;
        const hasH = exNum(p, "heightRaw") != null || p.heightMm != null;
        if (!hasW || !hasH || p.fanAttrs?.heightToBladeMm == null) continue;
        const fw = vbRound(widthNum(p));
        const fh = vbRound(heightNum(p));
        const ft = p.fanAttrs?.heightToBladeMm ?? 0;
        const pipeCell = exCell(p, "pipeLengthCell");
        const pipe = pipeCell == null || pipeCell === "" ? 0 : Number(pipeCell);
        let img = pipe === 0 ? (light ? "fanlightsize.gif" : "fansize.gif") : pipe <= 15 ? (light ? "fanlightsize-15cm_over.gif" : "fansize-15cm_over.gif") : light ? "fanlightsize-30cm_over.gif" : "fansize-30cm_over.gif";
        img = img.replace(".gif", "-y.gif");
        const sizeImg = `<img src="/lib/fan-taro/${img}" class="fan-sizeinfo" alt="サイズ寸法"><br>${NL}`;
        sizeTitle = true;
        s += `<div id="size-set">${NL}<span id="size_text" class="title_text">■SIZE　サイズ詳細</span>${NL}`;
        s += `<br>${NL}${sizeImg}${NL}`;
        s += `<span class="fansize fan-width">【A】：　${fw}mm</span><br>${NL}`;
        s += `<span class="fansize fan-height">【B】：　${fh}mm</span><br>${NL}`;
        s += `<span class="fansize fan-towing">【C】：約${ft}mm</span><br>${NL}</div>${NL}`;
      } else if (fn !== "") {
        if (!sizeTitle) {
          s += `<span class="title_text">■SIZE　サイズ詳細</span><br>${NL}`;
          sizeTitle = true;
        }
        s += `<img class="sizeinfo" src="${PIC}${fn}${YA_MAXW}" alt="${alt}"><br>${NL}<br>${NL}<br>${NL}`;
      }
    }
    for (let i = 0; i < 3; i++) {
      const fn = cells[IMG.F1 + i];
      if (fn !== "") s += `<img src="${PIC}${fn}${YA_MAXW}" alt="${alt}"><br>${NL}<br>${NL}<br>${NL}`;
    }
    if (cells[IMG.R1] !== "") {
      s += `<span class="title_text">■REMOCON　リモコン付属</span><br>${NL}`;
      s += `<img src="${PIC}${cells[IMG.R1]}${YA_MAXW}" alt="${alt}"><br>${NL}<br>${NL}<br>${NL}`;
    }
    if (cells[IMG.E1] !== "") s += `<img src="${PIC}${cells[IMG.E1]}${YA_MAXW}" alt="${alt}"><br>${NL}<br>${NL}<br>${NL}`;
    s += `<span class="title_text">■Effect of a circulation　効果</span><br>${NL}`;
    s +=
      `<img src="${PIC}circulation.gif" alt="シーリングファンのサーキュレーション効果"><br>${NL}` +
      "住宅の気密化が進み、室内の快適空調への要求がますます高まる中で、シーリングファンのもつ優れた特性は注目されています。エアコンとシーリングファンを併用することで、エアコン運転だけの場合と比べ、冷暖房費が大幅に節減できます。" +
      `シーリングファンを使用し室内の温度を均一な環境にすることで、エアコンの温度設定も低めに設定できます。<br>${NL}<br>${NL}`;
    if (light) {
      const tatami = exNum(p, "tatamiToRaw") ?? p.fanAttrs?.tatamiTo ?? 0;
      const lumen = exNum(p, "lumenRaw") ?? p.fanAttrs?.brightnessLm ?? 0;
      if (tatami < 10 || lumen < 3000) {
        s += `<img src="${PIC}brightness-ceilingfan-light.jpg" alt="シーリングファンライト照明の明るさ選びについて" class="brightness-info"><br>${NL}<br>${NL}<br>${NL}`;
      }
    }
    const vimg = exs(p, "variationImageRaw");
    if (vimg !== "") {
      const LC: Record<string, string> = {
        "light_color_l.jpg": "こちらの商品は照明の色合いは（電球色）となります。",
        "light_color_n.jpg": "こちらの商品は照明の色合いは（昼白色）となります。",
        "light_color_ln.jpg": "こちらの商品は照明の色合い（電球色・昼白色）をお選び頂きご購入ください。",
        "light_color_ld.jpg": "こちらの商品は照明の色合い（電球色・昼光色）をお選び頂きご購入ください。",
        "light_color_lnd.jpg": "こちらの商品は照明の色合い（電球色・昼白色・昼光色）をお選び頂きご購入ください。",
        "light_color_lwn.jpg": "こちらの商品は照明の色合い（電球色・温白色・昼白色）をお選び頂きご購入ください。",
      };
      const t = LC[vimg];
      s += t
        ? `<img src="${PIC}${vimg}" alt="${t}" class="light_color-choice"><br>${NL}<br>${NL}`
        : `<img src="${PIC}${vimg}" ><br>${NL}<br>${NL}`;
      s += `<br>${NL}`;
    }
    if (makerCode(p) !== "IM") {
      s += `<img id="cart_button" src="/lib/fan-taro/fazoo_nara.gif" class="lazy" data-original="/lib/fan-taro/fazoo_nara.gif" alt="fazooなら安心の90日間全額返金保証つき" style="display: inline;"><br>${NL}<br>${NL}`;
    }
  } else {
    // オプション単体商品
    const alt = cfPageTitle(p);
    const LOGO: Record<string, string> = {
      A: 'agled_logo.gif" alt="アグレッド', N: 'nec_logo.gif" alt="NEC', O: 'odelic_logo.gif" alt="オーデリック',
      K: 'koizumi_logo.gif" alt="コイズミ', W: 'hanwa_logo.gif" alt="阪和', D: 'daiko_logo.gif" alt="ダイコー',
      Z: 'takizumi_logo.gif" alt="タキズミ', L: 'dulton_logo.gif" alt="DULTON', M: 'tokyometal_logo.gif" alt="東京メタル',
      T: 'toshiba_logo.gif" alt="東芝', J: 'nihondenko_logo.gif" alt="日本電興', P: 'panasonic_logo.gif" alt="パナソニック',
      H: 'hermosa_logo.gif" alt="HERMOSA', E: 'mitsubishi_logo.gif" alt="三菱電機', X: 'mercros_logo.gif" alt="メルクロス',
      Y: 'youwa_logo.gif" alt="ユーワ', IM: 'minka-aire_logo.gif" alt="Minka Aire',
    };
    s = `<img src="${PIC}option.gif" alt="こちらはオプションの単体商品となりますので、単独では取り付けることができませんのでご注意ください。">${NL}<br>${NL}`;
    s += `<span class="title_text">■Manufacturer</span><br>${NL}<img src="${PIC}${LOGO[makerCode(p)] ?? ""}のメーカーロゴ"><br>${NL}<br>${NL}`;
    s += `<span class="title_text">■MAIN IMAGE</span><br>${NL}<img src="${PIC}${cells[IMG.M1]}" alt="${alt}"><br>${NL}`;
    if (cells[IMG.M2] !== "") s += `<img src="${PIC}${cells[IMG.M2]}" alt="${alt}"><br>${NL}<br>${NL}<br>${NL}`;
    if (cells[IMG.FHtml1] !== "") s += `${cells[IMG.FHtml1]}<br>${NL}<br>${NL}`;
    const plain = (fn: string) => (fn !== "" ? `<img src="${PIC}${fn}" alt="${alt}"><br>${NL}<br>${NL}<br>${NL}` : "");
    for (let i = 0; i < 10; i++) s += plain(cells[IMG.I1 + i]);
    for (let i = 0; i < 3; i++) s += plain(cells[IMG.F1 + i]);
    if (cells[IMG.R1] !== "") s += `<span class="title_text">■REMOCON　リモコン付属</span><br>${NL}` + plain(cells[IMG.R1]);
    s += plain(cells[IMG.E1]);
  }
  if (arrival(p) === "生産終了") {
    s = `<img src="${PIC}eol_banner.gif" alt="こちらの商品はメーカー生産終了品になります。">${NL}<br>${NL}<br>${NL}${s}`;
  }
  return s;
}
// Format(n, "0.00")
function vbFormat2(n: number): string {
  return (Math.round(n * 100 + (n >= 0 ? 1e-9 : -1e-9)) / 100).toFixed(2);
}

// 取付案内動画(SetInstallMov: YAHOO / YAHOO_SMP)
const INSTALL_VIDEOS: Record<string, { sec: string; blocks: Array<[string, string, string]> }> = {
  スタンダード: { sec: "30秒", blocks: [["■マンションなど鉄筋コンクリート造の場合", "（ローゼットへの固定）", "QqcZPusMWjA"], ["■戸建やアパートなど木造の場合", "（木ネジを使用しての固定）", "5mm9HLuJkn0"]] },
  Panaローゼット2本ネジ: { sec: "38秒、30秒", blocks: [["■マンションなど鉄筋コンクリート造の場合", "（ローゼットへの固定）", "UA646BNNo38"], ["■戸建やアパートなど木造の場合", "（木ネジを使用しての固定）", "5mm9HLuJkn0"]] },
  電気工事: { sec: "43秒", blocks: [["■電気工事タイプを木ネジを使用して設置", "（電気工事士の資格が必要です）", "C-_YYKYHAJk"]] },
  koizumiローゼット2本ネジ: { sec: "30秒", blocks: [["■マンションなど鉄筋コンクリート造の場合", "（ローゼットへの固定）", "VWuNEWO9srQ"], ["■戸建やアパートなど木造の場合", "（木ネジを使用しての固定）", "5mm9HLuJkn0"]] },
};
INSTALL_VIDEOS["マンションのみ電気工事"] = INSTALL_VIDEOS["電気工事"];
function installMov(p: ProductFull, smp: boolean): string {
  const v = INSTALL_VIDEOS[p.fanAttrs?.installVideoType ?? ""];
  if (!v) return "";
  let s = `<div style="text-align: center;max-width: 100%;">${NL}`;
  s += smp
    ? `<h5 style="background:#333;color:#fff;padding:8px 14px;margin:0 0 10px;">シーリングファンのベース金具<br>アタッチメント取り付け 説明動画（${v.sec}）</h5>${NL}`
    : `<h5 style="background:#333;color:#fff;padding:8px 14px;font-size: 1rem;">シーリングファンのベース金具 アタッチメント取り付け 説明動画（${v.sec}）</h5>${NL}`;
  for (const [title, sub, vid] of v.blocks) {
    s += smp
      ? `<div class="fazoo-youtube" width="90%">${NL}`
      : `<div class="fazoo-youtube" style="font-size: 15px; width: 48%; display: inline-block; padding: 0.6rem 0 3rem 0;">${NL}`;
    s += `<b>${title}</b><br>${NL}<span>${sub}</span>${NL}<!--Y youtube:vid=${vid} -->${smp ? "<br>" : ""}${NL}</div>${NL}`;
  }
  return `${s}</div>${NL}`;
}

// サブ紹介文1(lRow, YAHOO / YAHOO_SMP)
function subIntro1(p: ProductFull, smp: boolean): string {
  const indiv = exs(p, "subIndividualCell");
  if (indiv !== "") return indiv;
  let s = "";
  const st = arrival(p);
  const wait = arrivalText(p);
  if (st === "生産終了") {
    s += `<img src="${PIC}eol_banner.gif" alt="こちらの商品はメーカー生産終了品になります。">${NL}<br>${NL}<br>${NL}`;
  } else if (st === "即日発送") {
    s += `<img src="${PIC}shipping_12.gif" alt="15時までにご注文いただければ即日発送致します。"><br>${NL}<br>${NL}`;
  } else if ((st === "在庫切れ" || st === "即日切れ") && wait !== "") {
    if (wait !== "未定") s += `<span class="center2">こちらの商品は、『<span class="red2">${wait}</span>』でございます。</span>${NL}<br>${NL}`;
    s += `<img src="${PIC}shopping_reserve1.gif" alt="入荷待ち予約購入・受付中"><br>${NL}<br>${NL}`;
  } else if (st === "予約販売") {
    s += `<span style="font-size: 140%;font-weight: bold;color:red;">◆予約注文商品となります。</span>${NL}<br>${NL}`;
    s += `<img src="${PIC}shopping_reserve0.gif" alt="先行予約購入・受付中"><br>${NL}`;
    let dateText = arrivalDateText(wait) ?? "";
    if (dateText === "" && exNum(p, "identNo") === 1 && wait !== "") dateText = wait;
    if (wait === "未定") s += `<br>${NL}`;
    else s += `<span class="center2">こちらの商品は、『<span class="red2">${dateText}</span>』でございます。</span>${NL}<br>${NL}`;
  } else if (makerCode(p) === "IM") {
    s += `<span class="title_text">※海外製品は個人輸入での購入となります。<br>${NL}`;
    s += `　表示価格で購入頂けますが、為替レートや送料高騰などにより表示価格が変動する場合がございます。<br>${NL}`;
    s += `　海外製シーリングファンは90日間返金保証、3年保証の対象外となります。<br>${NL}`;
    s += `　お届けには1週間程度お時間が掛かる場合がございますので、<br>${NL}`;
    s += `　お急ぎの場合はお気軽にお問い合わせください。</span><br>${NL}<br>${NL}<br>${NL}`;
  } else {
    s += `<img src="${PIC}stock_info.gif" alt="事前に在庫を確認する場合は、メールまたはお電話にてお問い合わせください。"><br>${NL}<br>${NL}`;
  }
  if (priority(p) !== "△") {
    const i1 = note(p, "rosette"), i2 = note(p, "partialElectric"), i3 = note(p, "rosette2"), i4 = note(p, "boltFixing"), i5 = note(p, "other");
    const ALT_EL = "こちらの商品は電気工事が必要なので、ご注意ください。";
    const ALT_PART = "こちらの商品は一部電気が必要なので、ご注意ください。";
    const ALT_EASY = "こちらの商品は電気工事が不要な簡易取付タイプです。";
    const tag = (file: string, alt: string) => `<img src="${PIC}${file}" alt="${alt}"><p>${NL}`;
    if (i5 !== "") s += i5 === "○" ? tag("installation_02.gif", ALT_EL) : tag(i5, ALT_EL);
    else if (i4 !== "") {
      if (i4 === "panasonic_installation_01") s += tag("installation_02-02.gif", ALT_EL) + `<br>${NL}`;
      else s += i4 === "○" ? tag("installation_02.gif", ALT_EL) : tag(i4, ALT_EL);
    } else if (i2 !== "") s += i2 === "○" ? tag("installation_03.gif", ALT_PART) : tag(i2, ALT_PART);
    else if (i3 !== "") s += i3 === "○" ? tag("installation_04.gif", ALT_EASY) : tag(i3, ALT_EASY);
    else if (i1 !== "") {
      if (i1 === "○") s += tag("installation_01.gif", ALT_EASY);
      else if (i1 === "hanwa_installation_05") s += tag("hanwa_installation_05.gif", ALT_EASY);
      else if (i1 === "phiten_installation_01") s += tag("phiten_installation_01.gif", ALT_EASY);
    }
    s += installMov(p, smp);
  }
  const sub1 = exs(p, "subIntro1Raw");
  if (sub1 !== "") s += `<span class="item_details">${NL}＜商品詳細について＞<br>${NL}</span>${NL}${sub1}${NL}<br>${NL}`;
  return s;
}

function setCaption(p: ProductFull): string {
  let s = mainIntro(p) + NL;
  s = covUrlAndCase(s, "https://www.fazoo.biz/pic-labo/", "/lib/fan-taro/");
  s = covUrlAndCase(s, "//www.fazoo.biz/pic-labo/", "/lib/fan-taro/");
  s = covUrlAndCase(s, "https://fazoo.biz/cf_img/products_detail/", "/lib/fan-taro/");
  s = covUrlAndCase(s, "https://www.fazoo.biz/cf_img/products_detail/", "/lib/fan-taro/");
  s = covUrlAndCase(s, 'max-width="100%" ', 'style="max-width:100%;" ');
  return s.split("span").join("b"); // 現行どおり文字列 span をすべて b に置換
}

function setAdditional1(p: ProductFull, smp: boolean): string {
  let s = subIntro1(p, smp);
  s = covUrlAndCase(s, "https://www.fazoo.biz/pic-labo/", "/lib/fan-taro/");
  s = covUrlAndCase(s, "https://fazoo.biz/pic-labo/", "/lib/fan-taro/");
  s = covUrlAndCase(s, "https://www.fazoo.biz/img/", "/lib/fan-taro/");
  s = covUrlAndCase(s, "https://fazoo.biz/img/", "/lib/fan-taro/");
  s = covUrlAndCase(s, "//www.fazoo.biz/pic-labo/", "/lib/fan-taro/");
  return s.split("span").join("b");
}

// 商品に関する情報(SetExplanation): 商品名ID + 機能アイコンの alt 一覧 + Yahoo限定項目
function setExplanation(p: ProductFull): string {
  let s = (exs(p, "nameId") || p.productCode) + NL;
  let icons = cfFunctionIcons(p);
  for (;;) {
    const a = icons.indexOf('alt="');
    if (a < 0) break;
    const b = icons.indexOf('"', a + 5);
    s += `●${icons.slice(a + 5, b)}${NL}`;
    icons = icons.slice(b + 1);
  }
  let only = "";
  if (arrival(p) === "即日発送") only += `●即日発送${NL}`;
  const flags = (p.flags ?? {}) as Record<string, unknown>;
  if (flags.misc === "得") only += `●ファズーお買得商品${NL}`;
  if ((p.sellingPrice ?? 0) <= 40000 && cfHasLightModel(p)) only += `●4万円以下の商品${NL}`;
  if (only !== "") s += NL + only;
  return s;
}

function setPointCode(p: ProductFull): string {
  if (!(isListed(p) && priority(p) !== "△" && priority(p) !== "×" && arrival(p) !== "生産終了")) return "";
  let d = p.pointRate == null ? 0 : Number(p.pointRate);
  if (d - Math.floor(d) > 0) d = vbRound(d);
  if (d === 0) return ""; // 現行は停止
  return vbNum(d);
}

// 販促コード: 値引き率50%以上/20%以上
function setSpCode(p: ProductFull): string {
  const raw = exs(p, "listPriceRaw");
  if (raw === "O") return "";
  const list = Number(raw || p.listPriceInTax || 0);
  const ratio = (p.sellingPrice ?? 0) / list;
  // 現行の出力は末尾に半角スペースが付いている(出力シートのセル書式由来と思われる。再現)
  if (ratio <= 0.5) return "1000000680 ";
  if (ratio <= 0.8) return "1000000691 ";
  return "";
}

function setProductCode(p: ProductFull): string {
  let s = "";
  if (p.combinationModel) s = `${p.combinationModel}/`;
  if (p.modelNumber) s += `${p.modelNumber}/`;
  if (component(p, "FAN")) s += `${component(p, "FAN")}/`;
  if (component(p, "LIGHT")) s += `${component(p, "LIGHT")}/`;
  if (component(p, "PIPE")) {
    s += `${component(p, "PIPE")}/`;
    s = s.split("加工").join("Customize");
  }
  s = s.split("(拡散)").join("").split("(集光)").join("");
  s = s.split(" ").join("_");
  if (s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

// スペック1〜10(SpecMng)
const BODY_COLOR_SPEC: Record<string, string> = {
  ブラック: "10676", オフブラック: "10676", マットブラック: "10676",
  グレイ: "10684", チャコールグレー: "10684",
  ホワイト: "10678", オフホワイト: "10678", アイボリー: "10678", アンティークアイボリー: "10678",
  コア: "10681", ブラウン: "10681", ナチュラル: "10681", ダークブラウン: "10681",
  ブロンズ: "10686", ダークブロンズ: "10686", 金古美: "10686", 金古美メッキ: "10686", 真鍮ブロンズメッキ: "10686",
  金色ヘアラインメッキ: "10686", "乳白・ゴールド": "10686", "透明・ゴールド": "10686", ゴールド: "10686",
  シルバー: "10685", マットシルバー: "10685", シルバーメタリック: "10685", メッキ: "10685", ニッケルメッキ仕上: "10685",
  クロームメッキ: "10685", "乳白・シルバー": "10685", "透明・シルバー": "10685",
  グリーン: "10680", ミントグリーン: "10680", クリア: "236354", パープルブルー: "10688",
};
function specs(p: ProductFull): string[] {
  const out: string[] = [];
  const light = cfHasLightModel(p);
  const f = p.fanAttrs;
  if (light) {
    const vimg = exs(p, "variationImageRaw");
    if (vimg === "light_color_l.jpg") out.push("10|39");
    else if (vimg === "light_color_n.jpg") out.push("10|38");
    else if (vimg === "light_color_d.jpg") out.push("10|37");
    const kind = f?.lightKind ?? "";
    if (kind === "LED") out.push("1051|1620");
    else if (kind === "LED一体型") out.push("1051|260724");
    else if (kind === "白熱灯") out.push("1051|6493");
    else if (kind === "電球型蛍光灯") out.push("1051|6494");
  }
  const color = BODY_COLOR_SPEC[p.bodyColor ?? ""];
  if (color) out.push(`10011|${color}`); // 未知の色は現行もメッセージのみで出力なし
  const w = widthNum(p);
  if (w > 0) out.push(`12466|${vbRound(w / 10)}`);
  const h = heightNum(p);
  if (h > 0) out.push(`12467|${vbRound(h / 10)}`);
  if (light) {
    if ((f?.lightCount ?? 0) > 0) out.push(`26195|${f?.lightCount}`);
    if ((f?.dimming ?? "") === "無段階調光") out.push("29046|260710");
  }
  while (out.length < 10) out.push("");
  return out.slice(0, 10);
}

// 表示順: 生産終了 +100000 + 並び順番号 + 高さ
function setSort(p: ProductFull): string {
  return vbNum((arrival(p) === "生産終了" ? 100000 : 0) + (p.sortNo ?? 0) + heightNum(p));
}

function setSpAdditional(p: ProductFull): string {
  let s = setCaption(p) + NL + setAdditional1(p, true);
  const W100 = (file: string) => {
    s = covUrlAndCase(s, `${file}" `, `${file}" width="100%" `);
  };
  for (const f of [
    "circulation.gif", "fazoo_nara.gif", "installation_01.gif", "installation_02.gif", "installation_03.gif",
    "installation_04.gif", "shipping_12.gif", "shopping_reserve1.gif", "shopping_reserve0.gif",
  ]) W100(f);
  s = covUrlAndCase(s, 'jirei.gif" ', 'jirei.gif" width="75%" ');
  s = covUrlAndCase(s, 'img class="sizeinfo"', 'img class="sizeinfo" width="100%"');
  s = covUrlAndCase(s, 'img class="sizeinfo"', 'img class="sizeinfo" width="100%"');
  W100("odelic_wf237-239-247-249_f1.gif");
  s = covUrlAndCase(s, 'madeinjapan-cf_01.jpg" width="100%" ', 'madeinjapan-cf_01.jpg" ');
  W100("hanwa_installation_05.gif");
  W100("stock_info.gif");
  s = s.replace(/[\r\n ]+$/, "");
  s = covUrlAndCase(s, 'src="/lib/', 'src="https://shopping.c.yimg.jp/lib/');
  if (9300 < sjisLen(s)) {
    s = s.split('<b class="title_text">■Effect of a circulation　効果</b><br>').join("");
    s = s.split('<img src="https://shopping.c.yimg.jp/lib/fan-taro/circulation.gif" width="100%" alt="シーリングファンのサーキュレーション効果"><br>').join("");
    s = s
      .split(
        "住宅の気密化が進み、室内の快適空調への要求がますます高まる中で、シーリングファンのもつ優れた特性は注目されています。エアコンとシーリングファンを併用することで、エアコン運転だけの場合と比べ、冷暖房費が大幅に節減できます。シーリングファンを使用し室内の温度を均一な環境にすることで、エアコンの温度設定も低めに設定できます。<br>"
      )
      .join("");
    if (9300 < sjisLen(s)) s = s.split("高演色LED [R15]").join("");
  }
  return s;
}

// 発送日情報(SetLeadTimeInstock)
function setLeadTime(p: ProductFull): string {
  const st = arrival(p);
  if (st === "即日発送") return "1000";
  if (st === "在庫切れ") return "4";
  if (st === "即日切れ" && (arrivalText(p) !== "" || exNum(p, "identNo") === 3)) return "4";
  if (st === "予約販売") return "4";
  if (st === "生産終了") return "";
  if (st === "" || st === "即日切れ" || st === "即日OFF") {
    const lt = vbRound(Number(normalLeadTimeCell(p) || 0) + addLeadTime(p, 1));
    if (lt === 3) return "1";
    if (lt === 4) return "2";
    if (lt === 5) return "3";
    if (lt === 6) return "5";
    if (lt >= 10) return "6";
  }
  return "";
}

// 配送グループ(SetPostageSet)
function setPostageSet(p: ProductFull): string {
  const cell = normalLeadTimeCell(p);
  let s = cell !== "" ? (Number(cell) > 6 ? "6" : cell) : "4";
  const st = arrival(p);
  if (st === "即日発送") s = "2";
  else if (st === "在庫切れ" || st === "即日切れ" || st === "予約販売" || st === "生産終了") s = "7";
  else if (st === "") {
    // 現行は追加納期1〜3を合算(発送日情報は追加納期1のみ)
    const lt = vbRound(Number(cell || 0) + addLeadTime(p, 1) + addLeadTime(p, 2) + addLeadTime(p, 3));
    if (lt >= 3 && lt <= 6) s = String(lt);
  }
  return s;
}

// data_add 1行(SetOverwriteCSV_Yahoo)
export function yahooCfAddRow(p: ProductFull): string[] {
  const sp = specs(p);
  const lead = setLeadTime(p);
  const weight = weightNum(p);
  return [
    setPath(p),
    setName(p),
    p.productCode,
    setSubCode(p),
    setOriginalPrice(p),
    setPrice(p),
    "",
    setOptions(p),
    setHeadline(p),
    setCaption(p),
    "",
    setExplanation(p),
    setAdditional1(p, false),
    "",
    "",
    "",
    vbNum(weight * 1000),
    "1",
    "",
    "",
    setPointCode(p),
    "シーリングファン専門店fazooのyahoo!ショップ店です",
    arrival(p) === "生産終了" ? "0" : "1",
    "IT12",
    "",
    "",
    "",
    setSpCode(p),
    cfMaker(p, 14),
    "",
    setProductCode(p),
    "",
    "1",
    arrival(p) === "即日発送" ? "1" : "0",
    "",
    "535",
    ...sp,
    setSort(p),
    setSpAdditional(p),
    setSort(p),
    exs(p, "yahooListPriceUrl"),
    lead,
    lead,
    "1",
    setPostageSet(p),
  ];
}
