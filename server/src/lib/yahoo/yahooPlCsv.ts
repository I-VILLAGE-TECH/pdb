// Yahoo PL の CSV(新規登録・更新 / 価格更新 / 在庫変更 / 生産終了)。現行の Yahoo(PL)スプレッドシートの GAS
// (Yahoo_CSV作成.js・Yahoo_PL販売用説明文.js)の移植。入力は Yahoo シートと同じ並びの台帳の行(セル配列。台帳「ペンダントライト一覧」と同じ並び)で、
// GAS の関数名・処理順をそのまま残している。
// - セルの値は GAS の getValues と同じ型(空欄は ""、数値は number、日付は Date)。文字列前提のメソッドを数値のセルに呼ぶと GAS と同じく例外になる
// - 新規登録は、GAS と同じく例外の出た行(説明文のバイト数超過・辞書に無いメーカー等)を出力せず errors に回す(GAS の「CSV出力エラー」シート)
// - console.error(全高の未入力・不整合)は warnings に集める
import { CONFIG, CONFIG_YAHOO, SHOP_DATA } from "./gasConstants.js";
import { YAHOO_PL_DESC_TEMPLATE } from "./gasTemplates.js";
import { evaluateTemplate } from "../rakuten/gasTemplate.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Row = any[];
export type YahooOperate = "新規登録" | "価格更新" | "在庫変更" | "生産終了";
export type YahooCtx = { errors: string[]; warnings: string[] };

// =====================================================================
// Yahoo_CSV作成.js
// =====================================================================

/** CSV の行(1行目は見出し)。GAS の convertYahooCsv(PL のみ) */
export function convertYahooCsv(ctx: YahooCtx, data: Row[], operate: YahooOperate): any[][] {
  if (operate === "価格更新") return convertYahooUpdatePricePlCsv(data);
  if (operate === "在庫変更") return convertYahooChangeStockPlCsv(data);
  if (operate === "生産終了") return convertYahooEolPlCsv(data);
  return convertYahooPlCsv(ctx, data);
}

function convertYahooPlCsv(ctx: YahooCtx, data: Row[]): any[][] {
  const processedData: any[][] = [];
  processedData.push(CONFIG_YAHOO.HEADER_ITEM.NEW_PL_PRODUCT_HEADER);
  for (const rowdata of data) {
    const productManageNo = rowdata[CONFIG.PL_SHEET.LISTITEM_PRODUCT_MANAGE_ID_POS];
    if (!productManageNo) continue;
    try {
      processedData.push(_editYahooPlCsvProductLevel(ctx, rowdata, productManageNo));
    } catch (e) {
      ctx.errors.push(`${productManageNo}\t${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
    }
  }
  return processedData;
}

function _editYahooPlCsvProductLevel(ctx: YahooCtx, rowdata: Row, productManageNo: any): any[] {
  const path = _editYahooPlPath(rowdata);
  const name = _editYahooPlProductName(rowdata);
  const code = productManageNo;
  const originalPrice = convertNumberItemHyphen2Null(rowdata[CONFIG.PL_SHEET.LISTITEM_LIST_PRICE_INC_TAX_POS]) || "0";
  const price = convertNumberItemHyphen2Null(rowdata[CONFIG.PL_SHEET.LISTITEM_TOTAL_SELL_PRICE_POS]) || "0";
  const options = _editYahooPlOptions();
  const caption = _editYahooPlItemDesc(ctx, rowdata);
  const explanation = code + "\n\n" + rowdata[CONFIG.PL_SHEET.LISTITEM_PRODUCT_COMMENT_POS];
  const rawProductCode = rowdata[CONFIG.PL_SHEET.LISTITEM_MODEL_NO_MANUFACTURER_POS] || "";
  // メーカー型番にスペースは使えないため、半角・全角とも取り除く
  const productCode = String(rawProductCode).replace(/\s+/g, "");
  const spAdditional = _editYahooPlItemDesc(ctx, rowdata, true);
  const leadTimeInstock = _editYahooPlSetLeadTimeInstock(rowdata);
  const postageSet = _editYahooPlSetPostageSet(rowdata);

  // Yahoo の見出し順(sub-code・headline 等の空欄、taxable・display 等の固定値は GAS どおり)
  let productDataRow: any[] = [
    path, name, code, "", originalPrice, price, options,
    "", caption, "", explanation,
    "", "", "",
    "", "1", "", "", "", "1",
    "", "", "",
    "", "", productCode, "", "1", "0", "40737",
    "", "", "", "", "",
    "", "", "", "", "",
    "", spAdditional,
    leadTimeInstock, leadTimeInstock, "1", postageSet,
  ];
  const totalColumns = CONFIG_YAHOO.HEADER_ITEM.NEW_PL_PRODUCT_HEADER.length;
  if (productDataRow.length < totalColumns) {
    productDataRow = productDataRow.concat(Array(totalColumns - productDataRow.length).fill(""));
  }
  return productDataRow;
}

/** カテゴリパス: 種別カテゴリ:取付タイプ:メイングループ */
function _editYahooPlPath(rowdata: Row): string {
  const item_type = rowdata[CONFIG.PL_SHEET.LISTITEM_ITEM_TYPE];
  const installationType = rowdata[CONFIG.PL_SHEET.LISTITEM_INSTALLATION_TYPE_POS] || "";
  const mainGroup = rowdata[CONFIG.PL_SHEET.LISTITEM_MAINGROUP] || "";
  const typeMap: Record<string, string> = { PL: "ペンダントライト", CL: "シーリングライト" };
  const type = typeMap[item_type] || item_type;
  let path = type;
  if (installationType && mainGroup) path += `:${installationType}:${mainGroup}`;
  else if (installationType) path += `:${installationType}`;
  return path;
}

/** オプション: 返品・破損についての固定の文言(改行区切り) */
function _editYahooPlOptions(): string {
  return [
    "ペンダントライトは開封・未使用問わず返品交換不可です。 =選択して下さい 理解した",
    "",
    "破損・品違いは到着7日以内にご連絡下さい。 =選択して下さい 理解した",
  ].join("\n");
}

function _editYahooPlItemDesc(ctx: YahooCtx, rowdata: Row, isPhone = false): string {
  return _PLCreateYahooHTML(ctx, rowdata, "Yahoo", isPhone);
}

function convertYahooUpdatePricePlCsv(data: Row[]): any[][] {
  const processedData: any[][] = [CONFIG_YAHOO.HEADER_ITEM.CFPL_UPDATE_PRICE_HEADER];
  for (const rowdata of data) {
    const productManageNo = rowdata[CONFIG.PL_SHEET.LISTITEM_PRODUCT_MANAGE_ID_POS];
    if (!productManageNo) continue;
    const regularPrice = convertNumberItemHyphen2Null(rowdata[CONFIG.PL_SHEET.LISTITEM_TOTAL_SELL_PRICE_POS]) || "0";
    const originalPrice = convertNumberItemHyphen2Null(rowdata[CONFIG.PL_SHEET.LISTITEM_LIST_PRICE_INC_TAX_POS]) || "0";
    processedData.push([productManageNo, originalPrice, regularPrice]);
  }
  return processedData;
}

/** 在庫変更(quantity)。在庫数は全件 99 固定(GAS どおり。入荷待ちでも 99) */
function convertYahooChangeStockPlCsv(data: Row[]): any[][] {
  const processedData: any[][] = [["code", "sub-code", "quantity"]];
  for (const rowdata of data) {
    const productManageNo = rowdata[CONFIG.PL_SHEET.LISTITEM_PRODUCT_MANAGE_ID_POS];
    if (!productManageNo) continue;
    processedData.push([productManageNo, "", "99"]);
  }
  return processedData;
}

/** 生産終了(data_del)。現行の GAS は呼び出し側(Main.js の outputEOLCSV)の引数がずれていて出力できない。関数の意図どおりに出す */
function convertYahooEolPlCsv(data: Row[]): any[][] {
  const processedData: any[][] = [["code", "sub-code"]];
  for (const rowdata of data) {
    const productManageNo = rowdata[CONFIG.PL_SHEET.LISTITEM_PRODUCT_MANAGE_ID_POS];
    if (!productManageNo) continue;
    processedData.push([productManageNo, ""]);
  }
  return processedData;
}

/** 商品名: [設置タイプ 調光タイプ 電球色]代表的なイメージ名 | メーカー名(カナ)+種別 */
function _editYahooPlProductName(rowdata: Row): string {
  const dimming_type = rowdata[CONFIG.PL_SHEET.LISTITEM_DIMMING_TYPE];
  const light_color = rowdata[CONFIG.PL_SHEET.LISTITEM_LIGHT_COLOR_POS];
  const installationtype = rowdata[CONFIG.PL_SHEET.LISTITEM_INSTALLATION_TYPE_POS];
  const association_name = rowdata[CONFIG.PL_SHEET.LISTITEM_ASSOCIATION_NAME_POS];
  const maker_jp = rowdata[CONFIG.PL_SHEET.LISTITEM_MAKER_JP_NAME_POS];
  const item_type = rowdata[CONFIG.PL_SHEET.LISTITEM_ITEM_TYPE];
  const typeMap: Record<string, string> = { PL: "製ペンダントライト", CL: "製シーリングライト" };
  const type = typeMap[item_type] || item_type;
  let resultName = `[${installationtype} ${dimming_type} ${light_color}]${association_name} | ${maker_jp}${type}`;
  resultName = resultName.replace(/\s+/g, " ").trim();
  return _truncateToYahooNameLimitPl(resultName);
}

// 全角を2バイト、半角を1バイトとして数える(Shift_JIS 想定。GAS の getByteLength)
function getByteLength(text: string): number {
  let length = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if ((c >= 0x0 && c < 0x81) || c === 0xf8f0 || (c >= 0xff61 && c < 0xffa0) || (c >= 0xf8f1 && c < 0xf8f4)) length += 1;
    else length += 2;
  }
  return length;
}

/** 商品名の 150 バイト制限。超えるときは決められた語を順に取り除く(文字列は最初の1か所だけ、「N灯」はすべて) */
function _truncateToYahooNameLimitPl(str: string): string {
  let result = str;
  const removeList: Array<string | RegExp> = [
    "吹き抜け", "軽量", "ホワイト", "アイボリー",
    "明るさ8畳", "明るさ10畳", "明るさ12畳", "明るさ14畳",
    "簡易取付", "クラシック", "小型", "薄型", /\d+灯/g,
  ];
  let index = 0;
  while (getByteLength(result) > 150 && index < removeList.length) {
    result = result.replace(removeList[index], "");
    index++;
  }
  return result.trim();
}

/** 発送日情報: 入荷予定に値があれば 4(お客様との確認後30日以内)、無ければ空欄 */
function _editYahooPlSetLeadTimeInstock(rowdata: Row): string {
  return rowdata[CONFIG.PL_SHEET.LISTITEM_ARRIVAL_SCHEDULE_POS] ? "4" : "";
}

/** 配送グループ: 入荷予定に値があれば 7(メーカー欠品中:入荷待ち)、無ければ 6 */
function _editYahooPlSetPostageSet(rowdata: Row): string {
  return rowdata[CONFIG.PL_SHEET.LISTITEM_ARRIVAL_SCHEDULE_POS] ? "7" : "6";
}

// =====================================================================
// 00_CommonLogic.js
// =====================================================================

/** 数値項目のハイフン除去(最初の1つだけ)。空欄・0 は null */
function convertNumberItemHyphen2Null(target: any): string | null {
  let result: string | null = null;
  if (target != "") {
    result = String(target).replace("-", "");
    if (result == "") result = null;
  }
  return result;
}

// =====================================================================
// Yahoo_PL販売用説明文.js
// =====================================================================

const PL_IMG_POS_LIST = [
  "LISTITEM_IMG_MAIN1",
  ...Array.from({ length: 15 }, (_, i) => `LISTITEM_IMG_I${i + 1}`),
  "LISTITEM_IMG_S1", "LISTITEM_IMG_S2",
  ...Array.from({ length: 6 }, (_, i) => `LISTITEM_IMG_F${i + 1}`),
].map((k) => CONFIG.PL_SHEET[k] as number);

/** PC(caption)/スマホ(sp-additional)用の商品説明文 */
function _PLCreateYahooHTML(ctx: YahooCtx, rowdata: Row, shop_type: string, isPhone = false, productManageNo?: any): string {
  const html: Record<string, unknown> = {};
  const S = CONFIG.PL_SHEET;

  // 01. 入荷予定・在庫切れロゴ
  const nyuukamachi = rowdata[S.LISTITEM_ARRIVAL_SCHEDULE_POS];
  const awaitingStockMessage = rowdata[S.LISTITEM_ARRIVAL_AWAITING_STOCK_MESSAGE];
  let nyuukayotei_logo_url = "";
  let nyuukayotei_logo_url_alt = "";
  if (nyuukamachi) {
    nyuukayotei_logo_url = SHOP_DATA.COMMON_PIC["入荷待ち"][shop_type];
    nyuukayotei_logo_url_alt = SHOP_DATA.COMMON_PIC["入荷待ち"]["alt"];
    html.awaitingStockMessage = awaitingStockMessage;
  }
  html.nyuukayotei_logo_url = nyuukayotei_logo_url;
  html.nyuukayotei_logo_url_alt = nyuukayotei_logo_url_alt;

  const fazoo_unique_no = rowdata[S.LISTITEM_FAZOO_UNIQUE_NO_POS];

  // 03. 取り付けタイプ画像(辞書に無い取付タイプは GAS と同じく例外)
  const instalation_type = rowdata[S.LISTITEM_INSTALLATION_TYPE_POS];
  const instration_type_pic_url = SHOP_DATA.COMMON_PIC[instalation_type][shop_type];
  const instration_type_pic_alt = SHOP_DATA.COMMON_PIC[instalation_type]["alt"];
  if (instration_type_pic_url !== "") {
    html.instration_type_pic_url = instration_type_pic_url;
    html.instration_type_pic_alt = instration_type_pic_alt;
  } else {
    html.instration_type_pic_url = "";
    html.instration_type_pic_alt = "";
  }

  // 04. 画像一覧(Yahoo の追加画像 lib にアップロードした元の名前で参照する)
  const productName = _editYahooPlProductName(rowdata);
  const imgUrlList: string[] = [];
  const yahooLibBaseUrl = "/lib/fan-taro/";
  for (const imgPos of PL_IMG_POS_LIST) {
    const imgName = rowdata[imgPos];
    if (imgName && imgName !== "") imgUrlList.push(yahooLibBaseUrl + imgName);
  }
  html.imgUrlList = imgUrlList;
  html.productName = productName;

  // 05. メーカーロゴ、型番、取付タイプ(辞書に無いメーカーは GAS と同じく例外)
  const makerId = rowdata[S.LISTITEM_MAKER_ID_POS];
  html.maker_log_url = CONFIG.PL_MAKER[makerId]["ロゴ"][shop_type];
  html.maker_name = CONFIG.PL_MAKER[makerId]["英名"];
  html.fazoo_unique_no = fazoo_unique_no;
  html.instration_type = instalation_type + "タイプ";
  html.maker_kbn = makerId;

  const min_height = rowdata[S.LISTITEM_MIN_HEIGHT];
  const max_height = rowdata[S.LISTITEM_MAX_HEIGHT];
  let display_height = "";
  if (min_height && max_height && min_height < max_height) {
    display_height = min_height + "mm - " + max_height + "mm";
  } else if (!min_height && max_height) {
    display_height = max_height + "mm";
  } else if (min_height && min_height === max_height) {
    display_height = max_height + "mm";
  } else if (!min_height && !max_height) {
    ctx.warnings.push(`${fazoo_unique_no}\t高さが入力されていません`);
    display_height = "データなし";
  } else {
    ctx.warnings.push(`${fazoo_unique_no}\t全高の数値に不整合があります（最小 > 最大 など）`);
    display_height = "入力エラー";
  }
  html.width = rowdata[S.LISTITEM_WIDTH_POS];
  html.depth = rowdata[S.LISTITEM_DEPTH_POS];
  html.height = rowdata[S.LISTITEM_HEIGHT_POS];
  html.bulbbase = rowdata[S.LISTITEM_BULBBASE_POS];
  html.display_height = display_height;

  html.bulb_type = rowdata[S.LISTITEM_LIGHT_TYPE_POS];
  html.dimming_type = rowdata[S.LISTITEM_DIMMING_TYPE];
  html.dimming_method = rowdata[S.LISTITEM_DIMMING_METHOD];

  // 機能詳細1〜4 は改行を <br> に(数値のセルは GAS と同じく例外)。5 は Yahoo 用に画像パスとリンクを直す
  const replaceBr = (text: any) => (text ? text.replace(/\r?\n/g, "<br>") : "");
  html.function_detail1 = replaceBr(rowdata[S.LISTITEM_FUNCTION_DETAIL1_POS]);
  html.function_detail2 = replaceBr(rowdata[S.LISTITEM_FUNCTION_DETAIL2_POS]);
  html.function_detail3 = replaceBr(rowdata[S.LISTITEM_FUNCTION_DETAIL3_POS]);
  html.function_detail4 = replaceBr(rowdata[S.LISTITEM_FUNCTION_DETAIL4_POS]);
  html.function_detail5 = convertHtmlForYahooSafe(rowdata[S.LISTITEM_FUNCTION_DETAIL5_POS]);

  let htmlContent = evaluateTemplate(YAHOO_PL_DESC_TEMPLATE, html);
  // スマホ用は span を b に置き換える
  if (isPhone) htmlContent = htmlContent.replace(/<span[^>]*>/gi, "<b>").replace(/<\/span>/gi, "</b>");
  htmlContent = sanitizeForShiftJis(htmlContent);
  return _truncateYahooHtmlLimit(htmlContent, isPhone, productManageNo);
}

/** 説明文のバイト数制限(PC 10,000 / スマホ 9,300)。超えたら例外(GAS は削らずにエラーにする) */
function _truncateYahooHtmlLimit(htmlStr: string, isPhone: boolean, productManageNo: any): string {
  const limitBytes = isPhone ? 9300 : 10000;
  if (getByteLength(htmlStr) > limitBytes) {
    const device = isPhone ? "スマホ" : "PC";
    // GAS は商品管理番号を渡していないため、メッセージは「[undefined] の…」になる
    throw new Error(`[${productManageNo}] の${device}用商品説明文が制限(${limitBytes}byte)を超過しています。商品説明文を短く修正してください。`);
  }
  return htmlStr.trim();
}

/** Shift_JIS で「?」になりやすい記号の置き換え。最後の2つで「～」「〜」はすべて波ダッシュ(U+301C)になる(GAS どおり) */
function sanitizeForShiftJis(text: string): string {
  if (!text) return "";
  return String(text)
    .replace(/−/g, "－")
    .replace(/—/g, "―")
    .replace(/〜/g, "～")
    .replace(/‐/g, "-")
    .replace(/–/g, "－")
    .replace(/～/g, "〜")
    .replace(/～/g, "〜");
}

/** 機能詳細5: 画像の src を Yahoo の lib に向け、リンク(a タグ)はタグだけ取り除く */
function convertHtmlForYahooSafe(htmlText: any): string {
  if (!htmlText) return "";
  return String(htmlText)
    .replace(/(src=")[^"]*\/([^"]+)(")/gi, `$1/lib/fan-taro/$2$3`)
    .replace(/<a\s+[^>]+>/gi, "")
    .replace(/<\/a>/gi, "");
}

/** GAS の outputCSV と同じ: カンマ・改行・ダブルクォートを含むときだけ "" で囲む */
export function toYahooCsvLine(row: any[]): string {
  return Array.from(row, (cell) => {
    let str = cell === null || cell === undefined ? "" : String(cell);
    if (str.includes(",") || str.includes("\n") || str.includes("\r") || str.includes('"')) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(",");
}
