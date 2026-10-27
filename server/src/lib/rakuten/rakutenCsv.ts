// 楽天 CSV(新規登録・更新 / 価格更新)。現行の楽天スプレッドシートの GAS(楽天_CSV作成.js・楽天_CF販売用説明文.js・
// 楽天_PL販売用説明文.js)の移植。入力は楽天シートと同じ並びの台帳の行(セル配列)で、GAS の関数名・処理順をそのまま残している。
// - セルの値は GAS の getValues と同じ型(空欄は ""、数値は number、日付は Date)。文字列前提のメソッド(toLowerCase・includes 等)を
//   数値のセルに呼ぶと GAS と同じく例外になる。呼び出し側は例外の出た行を出力せずエラー一覧に回す(現行は CSV 全体が止まる)
// - 楽天SKU番号・画像管理(CF/PL)はシートの代わりに ctx で受け取る。新規 SKU は ctx.skuRows に追記する(GAS と同じ)
// - console.error(画像未リネーム等の警告)は ctx.warnings に集める
import { CONFIG, CONFIG_RAKUTEN, SHOP_DATA } from "./gasConstants.js";
import { CF_SALES_DESC_TEMPLATE, PL_SALES_DESC_TEMPLATE } from "./gasTemplates.js";
import { evaluateTemplate } from "./gasTemplate.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Row = any[];

export type RakutenCtx = {
  // 楽天SKU番号シート(getDataRange().getValues() と同じく見出し行を含む。列: 商品管理番号・SKU管理番号・システム連携用SKU番号・
  // バリエーション項目キー1・バリエーション項目選択肢1)
  skuRows: any[][];
  // 画像管理(CF)/(PL) の2行目以降(列: ID・ファイル名・フォルダ1・フォルダ2・リネーム後・ファイルパス)。ファイル名が空の行は除いたもの
  imgCf: any[][];
  imgPl: any[][];
  warnings: string[];
};

export const RAKUTEN_SHEET = { CF: CONFIG.CF_SHEET.SHEET_NAME as string, PL: CONFIG.PL_SHEET.SHEET_NAME as string };

// =====================================================================
// 楽天_CSV作成.js
// =====================================================================

/** 新規登録・更新 / 価格更新の CSV 行(1行目は見出し) */
export function convertRakutenCsv(ctx: RakutenCtx, sheetName: string, data: Row[], operate?: "価格更新"): any[][] {
  if (sheetName === CONFIG.CF_SHEET.SHEET_NAME) {
    if (operate === "価格更新") return convertRakutenUpdatePriceCfCsv(ctx, data);
    return convertRakutenCfCsv(ctx, data);
  }
  if (operate === "価格更新") return convertRakutenUpdatePricePlCsv(data);
  return convertRakutenPlCsv(ctx, data);
}

function convertRakutenPlCsv(ctx: RakutenCtx, data: Row[]): any[][] {
  const processedData: any[][] = [];
  processedData.push(CONFIG_RAKUTEN.HEADER_ITEM.NEW_PL_PRODUCT_HEADER);
  for (const rowdata of data) {
    const productManageNo = rowdata[CONFIG.PL_SHEET.LISTITEM_PRODUCT_MANAGE_ID_POS];
    processedData.push(_editRakutenPlCsvProductLevel(ctx, rowdata, productManageNo));
    processedData.push(_editRakutenPlCsvSkuLevel(ctx, rowdata, productManageNo));
    _editRakutenPlCsvOptionLevel(processedData, productManageNo);
  }
  return processedData;
}

function _editRakutenPlCsvProductLevel(ctx: RakutenCtx, rowdata: Row, productManageNo: any): any[] {
  const productName = _editRakutenPlProductName(rowdata);
  const pcItemDesc = _PLCreateHTML(ctx, rowdata, "楽天");
  let smartPhoneSalesDesc = pcItemDesc.replace(/\s*style='[^']*'/gi, "");
  smartPhoneSalesDesc = smartPhoneSalesDesc.replace(/<\/?(dl|dt|dd|span)[^>]*>/gi, "");

  const f = CONFIG_RAKUTEN.RAKUTEN_PENDANT_LIGHT_FIXED_VAL;
  // キャッチコピーは GAS でコメントアウトされている(配列の空き要素=空欄)
  let productDataRow: any[] = [
    productManageNo.toLowerCase(), productManageNo, productName, f.WAREHOUSE_CODE_FIXED_VAL, f.SEARCH_DISP_FIXED_VAL,
    f.TAX_FLG_FIXED_VAL, f.ORDER_BTN_FIXED_VAL, f.INQUIRY_BTN_FIXED_VAL, f.STOCK_DISP_FIXED_VAL, f.CASH_ON_DELIVERY_FEE_FIXED,
    f.GENRE_ID_FIXED_VAL, undefined, pcItemDesc, smartPhoneSalesDesc, f.ITEM_INFO_LAYOUT_FIXED_VAL, f.HDR_FTR_LNV_FIXED_VAL,
    f.DISP_ORDER_FIXED_VAL, f.COMMON_DESC_S_FIXED_VAL, f.FEATURED_PRODUCT_FIXED_VAL, f.COMMON_DESC_L_FIXED_VAL,
    f.REVIEW_DISP_FIXED_VAL, f.MAKER_INFO_DISP_FIXED_VAL, f.SUBS_SETTING_FIXED_VAL, f.GROUP_SETTING_FIXED_VAL,
  ];

  const imgList: any[] = [];
  for (const img_pos of CONFIG_RAKUTEN.IMG_PL_SYS_POS_LIST) {
    const imgName = rowdata[img_pos];
    if (imgName === "" || imgName === "CUSTOM-SIZE") continue;
    const imgIdx = ctx.imgPl.findIndex((row) => row[1] === imgName);
    if (imgIdx === -1) ctx.warnings.push(`画像がアップロードされていません：${imgName}`);
    else imgList.push("CABINET", "/" + ctx.imgPl[imgIdx][5], productName);
  }
  productDataRow = productDataRow.concat(imgList);
  // 楽天の画像は15枚。16枚以上あると負の長さになり GAS と同じく例外(Invalid array length)
  productDataRow = productDataRow.concat(...Array(15 * 3 - imgList.length).fill(""));
  productDataRow = productDataRow.concat(...Array(29).fill(""));
  return productDataRow;
}

function _editRakutenPlCsvOptionLevel(processedData: any[][], productManageNo: any): void {
  const f = CONFIG_RAKUTEN.RAKUTEN_PENDANT_LIGHT_FIXED_VAL;
  processedData.push([
    productManageNo.toLowerCase(), ...Array(93).fill(""),
    f.PRODUCT_OPTION_TYPE_FIXED_VAL, f.PRODUCT_OPTION_NAME1_FIXED_VAL, f.PRODUCT_OPTION1_FIXED_VAL, f.PRODUCT_OPTION_REQUIRED_FIXED_VAL,
  ]);
  processedData.push([
    productManageNo.toLowerCase(), ...Array(93).fill(""),
    f.PRODUCT_OPTION_TYPE_FIXED_VAL, f.PRODUCT_OPTION_NAME2_FIXED_VAL, f.PRODUCT_OPTION1_FIXED_VAL, f.PRODUCT_OPTION_REQUIRED_FIXED_VAL,
  ]);
}

function _editRakutenPlCsvSkuLevel(ctx: RakutenCtx, rowdata: Row, productManageNo: any): any[] {
  const P = CONFIG.PL_SHEET;
  const f = CONFIG_RAKUTEN.RAKUTEN_PENDANT_LIGHT_FIXED_VAL;
  const regularPrice = rowdata[P.LISTITEM_TOTAL_SELL_PRICE_POS];
  const dispPrice = rowdata[P.LISTITEM_LIST_PRICE_INC_TAX_POS];
  const makerName = rowdata[P.LISTITEM_MANUFACTURER_NAME_EN_POS];
  const productManageId = rowdata[P.LISTITEM_PRODUCT_MANAGE_ID_POS];
  let categoryColor = rowdata[P.LISTITEM_CATEGORY_COLOR_POS];
  categoryColor = CONFIG_RAKUTEN.ITEM_ATTR4_ENABLE_COLORS.includes(categoryColor) ? categoryColor : "-";

  let stockQty = f.STOCK_QTY_FIXED_VAL;
  if (rowdata[P.LISTITEM_ARRIVAL_SCHEDULE_POS]) stockQty = 0; // 入荷待ち

  const skuData = ctx.skuRows.filter((row) => row[0].toLowerCase() === productManageNo.toLowerCase()).flat();
  let skuNo;
  if (skuData.length !== 0) {
    skuNo = skuData[1];
  } else {
    // 新規は商品管理番号の小文字。楽天SKU番号に追記(商品管理番号は元の表記)
    skuNo = productManageNo.toLowerCase();
    // シートは2列だけ書き込むが、読み戻すと他の列は空欄(getDataRange は5列)。比較で同じになるよう5列に揃える
    ctx.skuRows.push([productManageNo, skuNo, "", "", ""]);
  }

  return [
    productManageNo.toLowerCase(), ...Array(68).fill(""),
    skuNo, regularPrice, dispPrice, f.DOUBLE_PRICE_NO_FIXED_VAL, f.RESTOCK_BUTTON_FIXED_VAL, f.NOSHI_FLG_FIXED_VAL, stockQty,
    f.STOCK_REVERT_FIXED_VAL, f.OUT_OF_STOCK_ORDER_FIXED_VAL, f.STOCK_IN_DELIVERY_NO_FIXED_VAL, f.OUT_OF_STOCK_DELIVERY_MNG_NO_FIXED_VAL,
    f.STOCK_IN_LEADTIME_FIXED_VAL, f.SKU_WAREHOUSE_FIXED_VAL, f.POSTAGE_FIXED_VAL, f.SINGLE_UNIT_DELIVERY_FIXED_VAL,
    f.LEAVE_AT_DOOR_FLG_FIXED_VAL, f.NO_CATALOG_ID_REASON_FIXED_VAL, f.ITEM_ATTR1_NAME_FIXED_VAL, makerName,
    f.ITEM_ATTR2_NAME_FIXED_VAL, productManageId, f.ITEM_ATTR3_NAME_FIXED_VAL, f.ITEM_ATTR3_VAL_FIXED_VAL,
    f.ITEM_ATTR4_NAME_FIXED_VAL, categoryColor,
    ...Array(4).fill(""),
  ];
}

function _editRakutenPlProductName(rowdata: Row): string {
  const P = CONFIG.PL_SHEET;
  const dimming_type = rowdata[P.LISTITEM_DIMMING_TYPE];
  const light_color = rowdata[P.LISTITEM_LIGHT_COLOR_POS];
  const installationtype = rowdata[P.LISTITEM_INSTALLATION_TYPE_POS];
  const association_name = rowdata[P.LISTITEM_ASSOCIATION_NAME_POS];
  const product_name = rowdata[P.LISTITEM_DISPLAY_MNP_POS];
  const maker_jp = rowdata[P.LISTITEM_MAKER_JP_NAME_POS];
  const item_type = rowdata[P.LISTITEM_ITEM_TYPE];
  const typeMap: Record<string, string> = { PL: "製ペンダントライト", CL: "製シーリングライト" };
  const type = typeMap[item_type] || item_type;
  return `[${installationtype} ${association_name} ${dimming_type} ${light_color}]${product_name} ${maker_jp}${type}`;
}

function convertRakutenUpdatePriceCfCsv(ctx: RakutenCtx, data: Row[]): any[][] {
  let processedData: any[][] = [CONFIG_RAKUTEN.HEADER_ITEM.CFPL_UPDATE_PRICE_HEADER];
  for (const rowdata of data) {
    const productManageNo = rowdata[CONFIG.CF_SHEET.LISTITEM_PRODUCT_MANAGE_ID_POS].toLowerCase();
    const displayProductManageNo = _getProducId(rowdata);
    processedData.push([productManageNo, displayProductManageNo, "", "", ""]);
    processedData = processedData.concat(_editRakutenPriceCsvSkuLevel(ctx, rowdata, productManageNo));
  }
  return processedData;
}

function convertRakutenUpdatePricePlCsv(data: Row[]): any[][] {
  const processedData: any[][] = [CONFIG_RAKUTEN.HEADER_ITEM.CFPL_UPDATE_PRICE_HEADER];
  for (const rowdata of data) {
    const productManageNo = rowdata[CONFIG.PL_SHEET.LISTITEM_PRODUCT_MANAGE_ID_POS].toLowerCase();
    const displayProductManageNo = rowdata[CONFIG.PL_SHEET.LISTITEM_PRODUCT_MANAGE_ID_POS];
    processedData.push([productManageNo, displayProductManageNo, "", "", ""]);
    processedData.push(_editRakutenPricePlCsvSkuLevel(rowdata, productManageNo));
  }
  return processedData;
}

function convertRakutenCfCsv(ctx: RakutenCtx, data: Row[]): any[][] {
  let processedData: any[][] = [];
  processedData.push(CONFIG_RAKUTEN.HEADER_ITEM.NEW_CF_PROCUCT_HEADER);
  for (const rowdata of data) {
    const productManageNo = rowdata[CONFIG.CF_SHEET.LISTITEM_PRODUCT_MANAGE_ID_POS].toLowerCase();
    processedData.push(_editRakutenCsvProductLevel(ctx, rowdata, productManageNo));
    processedData = processedData.concat(_editRakutenCsvSkuLevel(ctx, rowdata, productManageNo));
    processedData.push(_editRakutenCsvOptionLevel(productManageNo));
  }
  return processedData;
}

function _editRakutenCsvProductLevel(ctx: RakutenCtx, rowdata: Row, productManageNo: any): any[] {
  const C = CONFIG.CF_SHEET;
  const displayProductId = _getProducId(rowdata);
  const productName = _editRakutenProductName(rowdata);
  const catchCopy = _editRakutenCatchCFCopy(rowdata);
  const pcItemDesc = _editRakutenPcCFItemDesc();
  const pcSalesDesc = _createCfHTML(ctx, rowdata);
  // スマートフォン用販売説明文は GAS で整形した後に空欄で上書きしている
  const smartPhoneSalesDesc = "";

  const variationItemKey = rowdata[C.LISTITEM_VARIATION1_ITEM_NAME_POS];
  const variationItemName = rowdata[C.LISTITEM_VARIATION1_ITEM_NAME_POS];
  const variationOptions = [
    rowdata[C.LISTITEM_VARIATION1_OPTION1_POS],
    rowdata[C.LISTITEM_VARIATION1_OPTION2_POS],
    rowdata[C.LISTITEM_VARIATION1_OPTION3_POS],
  ]
    .filter(Boolean)
    .join("|");

  const t = CONFIG_RAKUTEN.OUTPUT_CEILING_FAN_CSV_RAKUTEN_ITEM;
  let productDataRow: any[] = [
    productManageNo, displayProductId, productName, t.WAREHOUSE_CODE_FIXED_VAL, t.SEARCH_DISP_FIXED_VAL, t.TAX_FLG_FIXED_VAL,
    t.ORDER_BTN_FIXED_VAL, t.INQUIRY_BTN_FIXED_VAL, t.STOCK_DISP_FIXED_VAL, t.CASH_ON_DELIVERY_FEE_FIXED_VAL, t.GENRE_ID_FIXED_VAL,
    catchCopy, pcItemDesc, pcSalesDesc, smartPhoneSalesDesc, t.ITEM_INFO_LAYOUT_FIXED_VAL, t.HDR_FTR_LNV_FIXED_VAL,
    t.DISP_ORDER_FIXED_VAL, t.COMMON_DESC_S_FIXED_VAL, t.FEATURED_PRODUCT_FIXED_VAL, t.COMMON_DESC_L_FIXED_VAL,
    t.REVIEW_DISP_FIXED_VAL, t.MAKER_INFO_DISP_FIXED_VAL, variationItemKey, variationItemName, variationOptions,
  ];

  const imgList: any[] = [];
  const skipList = [C.LISTITEM_IMG_FEATURE1, C.LISTITEM_IMG_FS_FEATURE];
  for (const img_pos of CONFIG_RAKUTEN.IMG_CF_POS_LIST) {
    const imgName = rowdata[img_pos];
    if (imgName === "" || imgName === "CUSTOM-SIZE" || skipList.includes(img_pos)) continue;
    const imgIdx = ctx.imgCf.findIndex((row) => row[1] === imgName);
    if (imgIdx === -1) ctx.warnings.push(`画像がアップロードされていません：${imgName}`);
    else imgList.push("CABINET", "/" + ctx.imgCf[imgIdx][5], productName);
  }
  productDataRow = productDataRow.concat(imgList);
  productDataRow = productDataRow.concat(...Array(15 * 3 - imgList.length).fill(""));
  productDataRow = productDataRow.concat(...Array(28).fill(""));
  return productDataRow;
}

function _editRakutenCsvOptionLevel(productManageNo: any): any[] {
  const t = CONFIG_RAKUTEN.OUTPUT_CEILING_FAN_CSV_RAKUTEN_ITEM;
  return [
    productManageNo, ...Array(91).fill(""),
    t.PRODUCT_OPTION_TYPE_FIXED_VAL, t.PRODUCT_OPTION_NAME_FIXED_VAL, t.PRODUCT_OPTION1_FIXED_VAL, t.PRODUCT_OPTION2_FIXED_VAL,
    t.PRODUCT_OPTION3_FIXED_VAL, t.PRODUCT_OPTION4_FIXED_VAL, t.PRODUCT_OPTION_REQUIRED_FIXED_VAL,
  ];
}

function _editRakutenCsvSkuLevel(ctx: RakutenCtx, rowdata: Row, productManageNo: any): any[][] {
  const C = CONFIG.CF_SHEET;
  const t = CONFIG_RAKUTEN.OUTPUT_CEILING_FAN_CSV_RAKUTEN_ITEM;
  const variation1ItemName = rowdata[C.LISTITEM_VARIATION1_ITEM_NAME_POS];
  const regularPrice = rowdata[C.LISTITEM_SALE_PRICE1_INC_TAX_POS];
  const dispPrice = rowdata[C.LISTITEM_LIST_PRICE_INC_TAX_POS];
  const itemAttr1Val = rowdata[C.LISTITEM_MANUFACTURER_POS];
  // 価格統制品はメーカー型番、それ以外は fazoo 型番
  const itemAttr2Val = rowdata[C.LISTITEM_PRICE_CONTROL_POS] !== "" ? _editRakutenMakerProductId(rowdata) : _getProducId(rowdata);

  let stockQty = t.STOCK_QTY_FIXED_VAL;
  let skuWarehouse = t.SKU_WAREHOUSE_FIXED_VAL;
  let itemAttr4Val = rowdata[C.LISTITEM_COLOR_HONTAI_POS];
  itemAttr4Val = CONFIG_RAKUTEN.ITEM_ATTR4_ENABLE_COLORS.includes(itemAttr4Val) ? itemAttr4Val : "-";
  const nyuukayotei = rowdata[C.LISTITEM_ARRIVAL_SCHEDULE_POS];
  if (nyuukayotei === "在庫切れ" || nyuukayotei === "生産終了" || nyuukayotei === "即日切れ") stockQty = 0;
  if (nyuukayotei === "生産終了") skuWarehouse = 1;

  const tail = (skuNo: any, skuSyncNo: any, varName: any, varOption: any) => [
    productManageNo, ...Array(70).fill(""),
    skuNo, skuSyncNo, varName, varOption,
    regularPrice, dispPrice, stockQty, t.OUT_OF_STOCK_ORDER_FIXED_VAL, t.OUT_OF_STOCK_DELIVERY_MNG_NO_FIXED_VAL,
    skuWarehouse, t.SINGLE_UNIT_DELIVERY_FIXED_VAL, t.LEAVE_AT_DOOR_FLG_FIXED_VAL, t.NO_CATALOG_ID_REASON_FIXED_VAL,
    t.ITEM_ATTR1_NAME_FIXED_VAL, itemAttr1Val, t.ITEM_ATTR2_NAME_FIXED_VAL, itemAttr2Val,
    t.ITEM_ATTR3_NAME_FIXED_VAL, t.ITEM_ATTR3_VAL_FIXED_VAL, t.ITEM_ATTR4_NAME_FIXED_VAL, itemAttr4Val,
    ...Array(7).fill(""),
  ];

  const variation1Options = _rakutenCfSkuNames(rowdata);
  const rtnData: any[][] = [];
  const newSkuLst: any[][] = [];
  if (variation1Options.length === 0) {
    const skuData = ctx.skuRows.filter((row) => row[0].toLowerCase() === productManageNo.toLowerCase()).flat();
    const skuNo = skuData.length !== 0 ? skuData[1] : productManageNo.toUpperCase();
    rtnData.push(tail(skuNo, "", "", ""));
  } else {
    const variationDefName = rowdata[C.LISTITEM_VARIATION1_ITEM_NAME_POS];
    variation1Options.forEach((variationOption: any, j: number) => {
      const skuData = ctx.skuRows
        .filter(
          (row) =>
            row[0].toLowerCase() === productManageNo.toLowerCase() && row[3] === variationDefName && row[4] === variationOption
        )
        .flat();
      let skuNo;
      let skuSyncNo;
      if (skuData.length !== 0) {
        skuNo = skuData[1];
        skuSyncNo = skuData[2];
      } else {
        skuNo = String(j + 1);
        skuSyncNo = `${productManageNo}v${j + 1}`;
        newSkuLst.push([productManageNo, skuNo, skuSyncNo, variationDefName, variationOption]);
      }
      rtnData.push(tail(skuNo, skuSyncNo, variation1ItemName, variationOption));
    });
  }
  // 新規SKUは楽天SKU番号に追記(GAS は SKU 行を作り終えてからまとめて書く)
  ctx.skuRows.push(...newSkuLst);
  return rtnData;
}

function _editRakutenPriceCsvSkuLevel(ctx: RakutenCtx, rowdata: Row, productManageNo: any): any[][] {
  const C = CONFIG.CF_SHEET;
  const regularPrice = rowdata[C.LISTITEM_SALE_PRICE1_INC_TAX_POS];
  const priceTaxInc10 = rowdata[C.LISTITEM_LIST_PRICE_INC_TAX_POS];
  const variation1Options = _rakutenCfSkuNames(rowdata);
  const rtnData: any[][] = [];
  if (variation1Options.length === 0) {
    const skuData = ctx.skuRows.filter((row) => row[0].toLowerCase() === productManageNo.toLowerCase()).flat();
    const skuNo = skuData.length !== 0 ? skuData[1] : productManageNo.toUpperCase();
    rtnData.push([productManageNo, "", skuNo, regularPrice, priceTaxInc10]);
  } else {
    const variationDefName = rowdata[C.LISTITEM_VARIATION1_ITEM_NAME_POS];
    variation1Options.forEach((variationOption: any) => {
      const skuData = ctx.skuRows
        .filter(
          (row) =>
            row[0].toLowerCase() === productManageNo.toLowerCase() && row[3] === variationDefName && row[4] === variationOption
        )
        .flat();
      // 楽天SKU番号に無い選択肢は SKU 管理番号が空になる(価格更新では採番しない。GAS どおり)
      rtnData.push([productManageNo, "", skuData[1], regularPrice, priceTaxInc10]);
    });
  }
  return rtnData;
}

function _editRakutenPricePlCsvSkuLevel(rowdata: Row, productManageNo: any): any[] {
  const regularPrice = rowdata[CONFIG.PL_SHEET.LISTITEM_TOTAL_SELL_PRICE_POS];
  const dispPrice = rowdata[CONFIG.PL_SHEET.LISTITEM_LIST_PRICE_INC_TAX_POS];
  return [productManageNo, undefined, productManageNo, regularPrice, dispPrice];
}

/** 商品番号: ID通番2、無い場合は ID商品管理 */
function _getProducId(rowdata: Row): any {
  let id = rowdata[CONFIG.CF_SHEET.LISTITEM_ID_CD_NO2_POS];
  if (id === "") id = rowdata[CONFIG.CF_SHEET.LISTITEM_PRODUCT_MANAGE_ID_POS];
  return id;
}

function _editRakutenProductName(rowdata: Row): string {
  const C = CONFIG.CF_SHEET;
  const registrationPriority = rowdata[C.LISTITEM_REGISTRATION_PRIORITY_POS];
  const arrivalSchedule = rowdata[C.LISTITEM_ARRIVAL_SCHEDULE_POS];
  const manufacturerId = rowdata[C.LISTITEM_MANUFACTURER_ID_POS];
  const colorType = rowdata[C.LISTITEM_COLOR_TYPE_POS];
  const unitProductName = rowdata[C.LISTITEM_UNIT_PRODUCT_NAME_POS];
  const priceControl = rowdata[C.LISTITEM_PRICE_CONTROL_POS];
  const modelNointegrated = rowdata[C.LISTITEM_MODEL_NO_INTEGRATED_POS];
  const modelNoLight = rowdata[C.LISTITEM_MODEL_NO_LIGHT_POS];
  const productManageNo = rowdata[C.LISTITEM_PRODUCT_MANAGE_ID_POS];
  const productSerialNo2 = rowdata[C.LISTITEM_ID_CD_NO2_POS];

  const isDiscontinued = arrivalSchedule.includes("生産終了");
  const lowPriority = registrationPriority.includes("△");
  const hasLight = !(modelNointegrated == "" && modelNoLight == "");

  let displayKataban;
  if (priceControl !== "" && manufacturerId != "P") {
    displayKataban = _editRakutenMakerProductId(rowdata); // 価格統制品
  } else {
    displayKataban = productSerialNo2 !== "" ? _editRakutenOriginalProductId(productSerialNo2) : productManageNo;
  }
  const productName = [
    arrivalSchedule.includes("即日発送") ? "即日発送" : "",
    !isDiscontinued && !lowPriority && !manufacturerId.includes("IM") ? "長期保証" : "",
    manufacturerId === "P" ? _editRakutenMakerProductId(rowdata) : "", // パナソニック限定
    unitProductName,
    !isDiscontinued && !lowPriority ? _editRakutenProductFeatures(rowdata, hasLight) : "生産終了",
    CONFIG.MANUFACTURER_NAME_DIC[manufacturerId]["日本名"] || "",
    colorType.includes("ホワイト") ? "ホワイト" : colorType.includes("アイボリー") ? "アイボリー" : colorType.includes("クラシック") ? "クラシック" : "",
    !lowPriority && hasLight ? "シーリングファンライト" : !lowPriority && !hasLight ? "シーリングファン" : "シーリングファン オプション",
    displayKataban,
    isDiscontinued ? "生産終了品" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return _editRakutenShrinkString(productName, 255);
}

function _editRakutenMakerProductId(rowdata: Row): string {
  const C = CONFIG.CF_SHEET;
  const variations = [rowdata[C.LISTITEM_MODEL_VARIATION1_POS], rowdata[C.LISTITEM_MODEL_VARIATION2_POS], rowdata[C.LISTITEM_MODEL_VARIATION3_POS]]
    .filter(Boolean)
    .join(" / ");
  return [
    rowdata[C.LISTITEM_MODEL_NO_INTEGRATED_POS],
    rowdata[C.LISTITEM_MODEL_NO_FAN_POS],
    rowdata[C.LISTITEM_MODEL_NO_LIGHT_POS],
    rowdata[C.LISTITEM_MODEL_NO_EXTPIPE_POS],
    rowdata[C.LISTITEM_MODEL_NO_FLANGE_POS],
    rowdata[C.LISTITEM_MODEL_NO_OPTIONAL_RC_POS],
    rowdata[C.LISTITEM_MODEL_NO_OPTIONAL_FEATHER_POS],
    rowdata[C.LISTITEM_OPTIONAL_POS],
    variations,
  ]
    .filter(Boolean)
    .join(" + ");
}

/** 独自型番に整形(4文字目が数字なら3文字目の後、そうでなければ4文字目の後にハイフン) */
function _editRakutenOriginalProductId(productId: any): any {
  if (productId.length < 4) return productId;
  const pos = /^\d$/.test(productId[3]) ? 3 : 4;
  return productId.slice(0, pos) + "-" + productId.slice(pos);
}

function _editRakutenProductFeatures(rowdata: Row, hasLight: boolean): string {
  const C = CONFIG.CF_SHEET;
  const height = rowdata[C.LISTITEM_HEIGHT1_POS];
  const width = rowdata[C.LISTITEM_WIDTH_POS];
  const weight = rowdata[C.LISTITEM_WEIGHT_POS];
  const lightType = rowdata[C.LISTITEM_LIGHT_TYPE_POS];
  const lightNum = rowdata[C.LISTITEM_LIGHT_NUM_POS];
  const illuminanceTo = rowdata[C.LISTITEM_ILLUMINANCE_TO_POS];
  const dimmer = rowdata[C.LISTITEM_DIMMER_POS];
  const acdc = rowdata[C.LISTITEM_ACDC_POS];
  const airVolume = rowdata[C.LISTITEM_AIR_VOLUME_POS];
  const remoteCtrl = rowdata[C.LISTITEM_REMOTE_CTRL_POS];
  const slopeAttachable = rowdata[C.LISTITEM_SLOPE_ATTACHABLE_POS];
  return [
    height && !isNaN(height) && height > 0 && height < 350.0 ? "薄型" : "",
    width && !isNaN(width) && width > 0 && width < 900.0 ? "小型" : "",
    weight && !isNaN(weight) && weight > 0 && weight <= 5.0 && !hasLight ? "軽量" : "",
    weight && !isNaN(weight) && weight > 0 && weight <= 7.0 && hasLight ? "軽量" : "",
    lightType.includes("LED") && hasLight ? "LED" : "",
    lightNum && !isNaN(lightNum) && lightNum > 0 && hasLight ? lightNum + "灯" : "",
    CONFIG_RAKUTEN.ILLUMINANCE_DIC[illuminanceTo] || "",
    hasLight && (dimmer === "調光" || dimmer === "無段階調光") ? "調光" : "",
    hasLight && dimmer === "調光・光色切替" ? "調光・光色切替" : "",
    hasLight && dimmer === "調光・調色" ? "調光・調色" : "",
    acdc.includes("DC") ? "DCモーター" : "",
    airVolume >= 70.0 || airVolume === "large1" ? "大風量" : "",
    remoteCtrl.includes("プルSW") ? "プルスイッチ" : "",
    slopeAttachable && slopeAttachable != "NG" ? "吹き抜け 傾斜天井" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** 文字列を n バイト(UTF-8)以内に収める。収まらなければ "error"(GAS どおり) */
function _editRakutenShrinkString(inputString: string, bytes: number): string {
  const getByteSize = (s: string) => Buffer.byteLength(s, "utf8");
  const targets = CONFIG.RAKUTEN_DICTIONARY.SHRINK_PRODUCT_NAME_LIST;
  let result = inputString;
  if (getByteSize(result) <= bytes) return result;
  result = result.replace(/ \+ /g, "+").replace(/ \/ /g, "/");
  if (getByteSize(result) <= bytes) return result;
  for (const target of targets) {
    if (target instanceof RegExp) result = result.replace(target, "");
    else result = result.split(target).join("");
    result = result.replace(/ +/g, " ").trim();
    if (getByteSize(result) <= bytes) return result;
  }
  return "error";
}

function _editRakutenCatchCFCopy(rowdata: Row): string {
  const C = CONFIG.CF_SHEET;
  const listPriceIncTax = rowdata[C.LISTITEM_LIST_PRICE_INC_TAX_POS];
  const salePriceIncTax = rowdata[C.LISTITEM_SALE_PRICE1_INC_TAX_POS];
  const colorType = rowdata[C.LISTITEM_COLOR_TYPE_POS];
  const discount = Math.round((1 - salePriceIncTax / listPriceIncTax) * 100);
  const discountStr = typeof discount === "number" && discount > 0 ? discount + "%OFF " : "";
  // 「クラシック 」(末尾スペースつき)の判定は GAS のまま
  const styleStr = colorType.includes("北欧") ? "北欧 " : colorType.includes("クラシック ") ? "アジアン" : "";
  return discountStr + styleStr + "カフェ 人気 おしゃれ インテリア ファン";
}

function _editRakutenPcCFItemDesc(): string {
  return `<b >クーポン・割引の併用は出来かねます。</b><br>
                <a href='https://www.rakuten.ne.jp/gold/fazoo/maker_data/maker_catalog_evidence.html' target='_blank'>メーカー希望小売価格はメーカーカタログに基づいて掲載しています</a>`;
}

function _rakutenCfSkuNames(data: Row): any[] {
  const C = CONFIG.CF_SHEET;
  return [data[C.LISTITEM_VARIATION1_OPTION1_POS], data[C.LISTITEM_VARIATION1_OPTION2_POS], data[C.LISTITEM_VARIATION1_OPTION3_POS]].filter(
    (item) => item !== "" && item !== null && item !== undefined
  );
}

// =====================================================================
// 楽天_CF販売用説明文.js
// =====================================================================

function _createCfHTML(ctx: RakutenCtx, rowdata: Row): string {
  const C = CONFIG.CF_SHEET;
  const FI = SHOP_DATA.FEATURE_ICON;
  const PIC = SHOP_DATA.COMMON_PIC;
  const imgValues = ctx.imgCf;
  const html: Record<string, any> = {};

  // 01. 入荷予定、即日・在庫切れロゴ
  const nyuukayotei = rowdata[C.LISTITEM_ARRIVAL_SCHEDULE_POS];
  const awaitingStockMessage = rowdata[C.LISTITEM_ARRIVAL_AWAITING_STOCK_MESSAGE];
  const sikibetuNo = rowdata[C.LISTITEM_SIKIBETU_NO_POS];
  let nyuukayotei_logo_url = "";
  let nyuukayotei_logo_url_alt = "";
  if (nyuukayotei === "即日発送") {
    nyuukayotei_logo_url = `https://image.rakuten.co.jp/fazoo/cabinet/lib/1/shipping_12.gif`;
    nyuukayotei_logo_url_alt = `15時までにご注文いただければ即日発送致します。`;
  } else if (nyuukayotei === "在庫切れ") {
    nyuukayotei_logo_url = `https://image.rakuten.co.jp/fazoo/cabinet/lib1/shopping_reserve1.gif`;
    nyuukayotei_logo_url_alt = `入荷待ち予約購入・受付中`;
    html.awaitingStockMessage = awaitingStockMessage;
  } else if (nyuukayotei === "即日切れ" && sikibetuNo === 3) {
    nyuukayotei_logo_url = `https://image.rakuten.co.jp/fazoo/cabinet/lib1/shopping_reserve1.gif`;
    nyuukayotei_logo_url_alt = `入荷待ち予約購入・受付中`;
    html.awaitingStockMessage = awaitingStockMessage;
  }
  html.nyuukayotei_logo_url = nyuukayotei_logo_url;
  html.nyuukayotei_logo_url_alt = nyuukayotei_logo_url_alt;

  // 02. メーカーロゴ(辞書に無いメーカーは GAS と同じく例外)
  const maker_kbn = rowdata[C.LISTITEM_MANUFACTURER_ID_POS];
  html.maker_kbn = maker_kbn;
  html.maker_logo_url = CONFIG.MANUFACTURER_NAME_DIC[maker_kbn]["楽天"]["画像URL"];
  html.maker_logo_alt = CONFIG.MANUFACTURER_NAME_DIC[maker_kbn]["alt"];

  // 03. GoodDesignロゴ
  html.goodDesighYear = rowdata[C.LISTITEM_GOOD_DESIGN] === 2015;

  // 04. 生産国
  const made_in_japan = rowdata[C.LISTITEM_MADE_COUNTRY] === "Japan";
  html.made_in_japan = made_in_japan;

  // 05. メイン画像
  html.productName = _editRakutenProductName(rowdata);
  const m1Name = rowdata[C.LISTITEM_IMG_MAIN1];
  const imgM1idx = imgValues.findIndex((row) => row[1] === m1Name);
  html.m1ImgUrl = imgM1idx === -1 ? "" : imgValues[imgM1idx][5];

  // 06. 幅、高さ、羽根上の高さ
  html.width = rowdata[C.LISTITEM_WIDTH_POS];
  const height1 = rowdata[C.LISTITEM_HEIGHT1_POS];
  const height2 = rowdata[C.LISTITEM_HEIGHT2_POS];
  html.height = height2 !== "" ? `${height1} - ${height2}` : height1;
  html.haneue = rowdata[C.LISTITEM_HEIGHT_HANE];

  // 07. 重さ・傾斜取付可否
  html.weight = rowdata[C.LISTITEM_WEIGHT_POS];
  const slopeData = rowdata[C.LISTITEM_SLOPE_ATTACHABLE_POS];
  if (!slopeData || slopeData === "NG") html.slope = "傾斜不可";
  else if (String(slopeData).includes("-")) html.slope = `${slopeData}度`;
  else html.slope = `0 - ${slopeData}度`;

  // 08. 風量、風速、回転数
  const airVolume = rowdata[C.LISTITEM_AIR_VOLUME_POS];
  html.airVolume = airVolume;
  const airVelocity = rowdata[C.LISTITEM_AIR_VELOCITY_POS];
  html.airVelocity = airVelocity;
  html.rotationSpeed = rowdata[C.LISTITEM_AIR_ROTATION_SPEED_POS];

  // 09. メイン画像２(GAS はファイル名ではなくフォルダ1の列で探しているため、実質いつも空)
  const m2Name = rowdata[C.LISTITEM_IMG_MAIN2];
  const imgM2idx = imgValues.findIndex((row) => row[2] === m2Name);
  html.m2ImgUrl = imgM2idx === -1 ? "" : imgValues[imgM2idx][5];

  // 10. 組み合わせ商品(型番_一体型〜型番_オプションのうち2つ以上)
  const count = rowdata
    .slice(C.LISTITEM_MODEL_NO_INTEGRATED_POS, C.LISTITEM_OPTIONAL_POS + 1)
    .filter((cell: any) => cell !== "" && cell !== null && cell !== undefined).length;
  const isCombined = count >= 2;
  html.isCombined = isCombined;

  // 11. 保証アイコン
  const warrnanty = rowdata[C.LISTITEM_WARRANTY_TERM];
  const isWarranty = ["m06iv06", "m12iv12", "m12iv24"].includes(warrnanty);
  html.isWarranty = isWarranty;
  if (isWarranty) {
    html.warrnanty_icon_url = FI["3年保証アイコン"]["楽天"];
    html.warrnanty_icon_alt = FI["3年保証アイコン"]["alt"];
  }
  const isMakerWarranty = ["m12"].includes(warrnanty);
  html.isMakerWarranty = isMakerWarranty;
  if (isMakerWarranty) {
    html.maker_warrnanty_icon_url = FI["メーカー1年保証アイコン"]["楽天"];
    html.maker_warrnanty_icon_alt = FI["メーカー1年保証アイコン"]["alt"];
  }
  const is3MakerWarranty = ["m36"].includes(warrnanty);
  html.is3MakerWarranty = is3MakerWarranty;
  if (is3MakerWarranty) {
    html.maker_3warrnanty_icon_url = FI["3年保証アイコン"]["楽天"];
    html.maker_3warrnanty_icon_alt = FI["メーカー保証3年"]["alt"];
  }

  // 12. 日本製アイコン
  if (made_in_japan) {
    html.made_in_japan_icon_url = FI["日本製アイコン"]["楽天"];
    html.made_in_japan_icon_alt = FI["日本製アイコン"]["alt"];
  }

  // 13. 組み合わせ商品アイコン
  if (isCombined) {
    html.combined_icon_url = FI["組み合わせ商品アイコン"]["楽天"];
    html.combined_icon_alt = FI["組み合わせ商品アイコン"]["alt"];
  }

  // 14. ACDCモーターアイコン
  const morter = rowdata[C.LISTITEM_ACDC_POS];
  if (morter === "DC") {
    html.moter_icon_url = FI["DCモーターアイコン"]["楽天"];
    html.moter_icon_alt = FI["DCモーターアイコン"]["alt"];
  } else if (morter === "AC") {
    html.moter_icon_url = FI["ACモーターアイコン"]["楽天"];
    html.moter_icon_alt = FI["ACモーターアイコン"]["alt"];
  } else {
    html.moter_icon_url = "";
    html.moter_icon_alt = "";
  }

  // 15. LEDアイコン
  const isLed = rowdata[C.LISTITEM_LIGHT_TYPE_POS] === "LED";
  html.isLed = isLed;
  if (isLed) {
    html.led_icon_url = FI["LEDアイコン"]["楽天"];
    html.led_icon_alt = FI["LEDアイコン"]["alt"];
  }

  // 16. 照明の数
  const num_syoumei = rowdata[C.LISTITEM_LIGHT_NUM_POS];
  let has_syoumei = false;
  if (num_syoumei !== "") {
    has_syoumei = true;
    const file_name = FI["照明の数アイコン"]["ファイル名"].replace("XX", num_syoumei);
    html.syoumei_icon_url = FI["照明の数アイコン"]["楽天"] + file_name;
    html.syoumei_icon_alt = num_syoumei + FI["照明の数アイコン"]["alt"];
  }
  html.has_syoumei = has_syoumei;

  // 17. 明るさ(W)
  const brightness = rowdata[C.LISTITEM_BRIGHTNESS_W];
  let hasBrightness_w = false;
  if (brightness !== "") {
    hasBrightness_w = true;
    const fileName = FI["明るさWアイコン"]["ファイル名"].replace("XX", brightness);
    html.brightness_icon_url = FI["明るさWアイコン"]["楽天"] + fileName;
    html.brightness_icon_alt = brightness + FI["明るさWアイコン"]["alt"];
  }
  html.hasBrightness_w = hasBrightness_w;

  // 18. 明るさ(ルーメン)。alt は GAS どおり W の値を使う
  const brightness_lumen = rowdata[C.LISTITEM_BRIGHTNESS_LUMEN];
  let hasBrightness_lumen = false;
  if (brightness_lumen !== "") {
    hasBrightness_lumen = true;
    const fileName = FI["明るさルーメンアイコン"]["ファイル名"].replace("XX", brightness_lumen.toString().padStart(4, "0"));
    html.brightness_lumen_icon_url = FI["明るさルーメンアイコン"]["楽天"] + fileName;
    html.brightness_lumen_icon_alt = brightness + FI["明るさルーメンアイコン"]["alt"];
  }
  html.hasBrightness_lumen = hasBrightness_lumen;

  // 19. 照明広さ(XX畳まで)
  const brightness_teido = rowdata[C.LISTITEM_ILLUMINANCE_TO_POS];
  const hasBrightness_teido = [-1, 3, 4.5, 6, 8, 10, 12, 14].includes(brightness_teido);
  if (hasBrightness_teido) {
    // GAS は const に再代入するため、4.5畳(と明るさWが5.9)のときは例外になる
    if (brightness_teido === 4.5 || brightness === 5.9) throw new TypeError("Assignment to constant variable.");
    const fileName = FI["明るさ広さアイコン"]["ファイル名"].replace("XX", brightness_teido);
    html.brightness_teido_icon_url = FI["明るさ広さアイコン"]["楽天"] + fileName;
    html.brightness_teido_icon_alt = FI["明るさ広さアイコン"]["alt"].replace("XX", brightness_teido);
  }
  html.hasBrightness_teido = hasBrightness_teido;

  // 20. 調光・調色
  const dimmingText = rowdata[C.LISTITEM_DIMMER_POS];
  const hasDimming = dimmingText.includes("調光・");
  const hasSteplessDimming = dimmingText.includes("無段階調光");
  const hasColorControl = dimmingText.includes("光色切替") || dimmingText.includes("調色");
  if (hasDimming) {
    html.dimming_icon_url = FI["調光アイコン"]["楽天"];
    html.dimming_icon_alt = FI["調光アイコン"]["alt"];
  }
  if (hasSteplessDimming) {
    html.step_ledd_dimming_icon_url = FI["無段階調光アイコン"]["楽天"];
    html.step_ledd_dimming_icon_alt = FI["無段階調光アイコン"]["alt"];
  }
  if (hasColorControl) {
    html.color_control_icon_url = FI["光色アイコン"]["楽天"];
    html.color_control_icon_alt = FI["光色アイコン"]["alt"];
  }
  html.hasDimming = hasDimming;
  html.hasSteplessDimming = hasSteplessDimming;
  html.hasColorControl = hasColorControl;

  // 21. 電球色
  const hasVariation = rowdata[C.LISTITEM_VARIATION1_ITEM_NAME_POS] === "照明の色合";
  const variation_val2 = rowdata[C.LISTITEM_VARIATION1_OPTION2_POS];
  const variation_val3 = rowdata[C.LISTITEM_VARIATION1_OPTION3_POS];
  if (hasVariation) {
    const key = variation_val3.includes("昼光色")
      ? "電球3色アイコン"
      : variation_val2.includes("昼光色")
        ? "電球2色アイコン_昼光色"
        : "電球2色アイコン_昼白色";
    html.denkyu_color_icon_url = FI[key]["楽天"];
    html.denkyu_color_icon_alt = FI[key]["alt"];
  }
  html.hasVariation = hasVariation;

  // 22. リモコン(想定外の値は GAS ではアイコンが未設定のままになり、テンプレートで例外になる)
  const remote_control = rowdata[C.LISTITEM_REMOTE_CTRL_POS];
  const hasRimokon = !["", "-"].includes(remote_control);
  if (hasRimokon) {
    const key: Record<string, string> = {
      あり: "リモコンアイコン",
      "1ch": "リモコンアイコン",
      "2ch": "リモコン2chアイコン",
      "3ch": "リモコン3chアイコン",
      プルSW: "リモコンプルスイッチアイコン",
    };
    const k = Object.hasOwn(key, remote_control) ? key[remote_control] : null;
    if (k) {
      html.remocon_icon_url = FI[k]["楽天"];
      html.remocon_icon_alt = FI[k]["alt"];
    }
  }
  html.hasRimokon = hasRimokon;

  // 23. 風速
  const hasVelocity = airVelocity !== "";
  if (hasVelocity) {
    const code = airVelocity >= 3.3 ? 330 : airVelocity >= 3.0 ? 300 : String(airVelocity * 10) + "0";
    const fileName = FI["風速アイコン"]["ファイル名"].replace("XX", code);
    html.air_velocity_icon_url = FI["風速アイコン"]["楽天"] + fileName;
    html.air_velocity_icon_alt = FI["風速アイコン"]["alt"].replace("XX", airVelocity);
  }
  html.hasVelocity = hasVelocity;

  // 24. 風量アイコン
  if (typeof airVolume === "number") {
    if (airVolume >= 300) {
      const fileName = FI["風量アイコン"]["ファイル名"].replace("XX", 300);
      html.air_volume_icon_url = FI["風量アイコン"]["楽天"] + fileName;
      html.air_volume_icon_alt = FI["風量アイコン"]["alt"].replace("XX", 300);
    } else if (airVolume >= 5) {
      const formattedAirflow = String(Math.floor(airVolume / 5) * 5).padStart(3, "0");
      const fileName = FI["風量アイコン"]["ファイル名"].replace("XX", formattedAirflow);
      html.air_volume_icon_url = FI["風量アイコン"]["楽天"] + fileName;
      html.air_volume_icon_alt = FI["風量アイコン"]["alt"].replace("XX", formattedAirflow);
    }
  } else if (airVolume === "large1") {
    html.air_volume_icon_url = FI["大風量アイコン"]["楽天"];
    html.air_volume_icon_alt = FI["大風量アイコン"]["alt"];
  }

  // 25. リズム回転
  const hasRithm = rowdata[C.LISTITEM_RITHM_ROTATE] === "あり";
  if (hasRithm) {
    html.rithm_rotate_icon_url = FI["リズム回転アイコン"]["楽天"];
    html.rithm_rotate_icon_alt = FI["リズム回転アイコン"]["alt"];
  }
  html.hasRithm = hasRithm;

  // 26. 羽根リバーシブル
  const bladeColor1 = rowdata[C.LISTITEM_COLOR_BLADE1];
  const bladeColor2 = rowdata[C.LISTITEM_COLOR_BLADE2];
  const isReversible = bladeColor1 && bladeColor2 && bladeColor1 !== bladeColor2;
  if (isReversible) {
    html.reversible_icon_url = FI["リバーシブルアイコン"]["楽天"];
    html.reversible_icon_alt = FI["リバーシブルアイコン"]["alt"];
  }
  html.isReversible = isReversible;

  // 27. 傾斜
  const degrees = rowdata[C.LISTITEM_SLOPE_ATTACHABLE_POS];
  const hasDegrees = degrees !== "";
  if (hasDegrees) {
    if (degrees === "NG") {
      html.degrees_icon_url = FI["傾斜不可アイコン"]["楽天"];
      html.degrees_icon_alt = FI["傾斜不可アイコン"]["alt"];
    } else {
      const fileName = FI["傾斜アイコン"]["ファイル名"].replace("XX", degrees);
      html.degrees_icon_url = FI["傾斜アイコン"]["楽天"] + fileName;
      html.degrees_icon_alt = FI["傾斜アイコン"]["alt"].replace("XX", degrees);
    }
  }
  html.hasDegrees = hasDegrees;

  // 28. 軽量(GAS どおり空欄も 0 として軽量扱い)
  const hasKeiryou = rowdata[C.LISTITEM_WEIGHT_POS] <= 7;
  if (hasKeiryou) {
    html.keiryou_icon_url = FI["軽量アイコン"]["楽天"];
    html.keiryou_icon_alt = FI["軽量アイコン"]["alt"];
  }
  html.hasKeiryou = hasKeiryou;

  // 29. 簡易取り付け、電気工事取付
  const torituke1 = rowdata[C.LISTITEM_TORITUKE1];
  const torituke2 = rowdata[C.LISTITEM_TORITUKE2];
  const torituke3 = rowdata[C.LISTITEM_TORITUKE3];
  const torituke4 = rowdata[C.LISTITEM_TORITUKE4];
  const torituke5 = rowdata[C.LISTITEM_TORITUKE5];
  const toritukeKey =
    torituke1 !== "" ? "簡易取付" : torituke2 !== "" ? "一部電気工事" : torituke3 !== "" ? "簡易取付" : torituke4 !== "" || torituke5 !== "" ? "電気工事取付" : null;
  html.torituke_icon_url = toritukeKey ? FI[toritukeKey]["楽天"] : "";
  html.torituke_icon_alt = toritukeKey ? FI[toritukeKey]["alt"] : "";

  // 30. PSEマーク(AC・DC 以外のときは alt が未設定のままになり、テンプレートで例外になる。GAS どおり)
  const acdc_moter = rowdata[C.LISTITEM_ACDC_POS];
  const is_maker_japan = rowdata[C.LISTITEM_MANUFACTURER_ID_POS] !== "IM";
  html.pse_icon_url = "";
  if (is_maker_japan) {
    if (acdc_moter === "AC" || acdc_moter === "DC") {
      html.pse_icon_url = FI["PSEアイコン"]["楽天"];
      html.pse_icon_alt = FI["PSEアイコン"]["alt"];
    } else {
      ctx.warnings.push("モーターはACまたはDCです。");
    }
  }
  html.is_maker_japan = is_maker_japan;

  // 31. 加工パイプ
  const isProcessedpipe = rowdata[C.LISTITEM_PIPE_POS] === "加工パイプ";
  if (isProcessedpipe) {
    html.processedpipe_gazo_url = PIC["fazooオリジナル延長パイプについて"]["楽天"];
    html.processedpipe_gazo_alt = PIC["fazooオリジナル延長パイプについて"]["alt"];
  }
  html.isProcessedpipe = isProcessedpipe;

  // 32. 画像10枚
  const imgUrlList: any[] = [];
  for (const imgPos of [C.LISTITEM_IMG_I1, C.LISTITEM_IMG_I2, C.LISTITEM_IMG_I3, C.LISTITEM_IMG_I4, C.LISTITEM_IMG_I5,
    C.LISTITEM_IMG_I6, C.LISTITEM_IMG_I7, C.LISTITEM_IMG_I8, C.LISTITEM_IMG_I9, C.LISTITEM_IMG_I10]) {
    const imgName = rowdata[imgPos];
    if (imgName !== "") {
      const imgIdx = imgValues.findIndex((row) => row[1] === imgName);
      if (imgIdx !== -1) imgUrlList.push(imgValues[imgIdx][5]);
    }
  }
  html.imgUrlList = imgUrlList;

  // 34. サイズ寸法
  const isCustomSize = rowdata[C.LISTITEM_IMG_S1] === "CUSTOM-SIZE";
  if (!isCustomSize) {
    const imgSizeUrlList: any[] = [];
    for (const imgPos of [C.LISTITEM_IMG_S1, C.LISTITEM_IMG_S2]) {
      const imgName = rowdata[imgPos];
      if (imgName !== "") {
        const imgIdx = imgValues.findIndex((row) => row[1] === imgName);
        if (imgIdx !== -1) imgSizeUrlList.push(imgValues[imgIdx][5]);
      }
    }
    html.imgSizeUrlList = imgSizeUrlList;
  } else {
    const pipeLength = rowdata[C.LISTITEM_PIPE_LENGTH];
    const light = _hasLight(rowdata) ? "ライト有り" : "ライト無し";
    const pipe = pipeLength === "" ? "直付け" : pipeLength <= 15 ? "短パイプ" : "長パイプ";
    html.size_gazo_url = PIC[`サイズ_${light}_${pipe}`]["楽天"];
    html.size_gazo_alt = PIC[`サイズ_${light}_${pipe}`]["alt"];
    html.fan_width = rowdata[C.LISTITEM_WIDTH_POS];
    html.fan_height = rowdata[C.LISTITEM_HEIGHT1_POS];
    html.fan_towing = rowdata[C.LISTITEM_HEIGHT_HANE];
  }
  html.isCustomSize = isCustomSize;

  // 35〜37. 機能イメージ画像1・リモコン画像・付属画像
  const imgUrlOf = (name: any) => {
    if (name === "") return "";
    const idx = imgValues.findIndex((row) => row[1] === name);
    return idx === -1 ? "" : imgValues[idx][5];
  };
  html.f1ImgUrl = imgUrlOf(rowdata[C.LISTITEM_IMG_F1]);
  html.r1ImgUrl = imgUrlOf(rowdata[C.LISTITEM_IMG_R1]);
  html.e1ImgUrl = imgUrlOf(rowdata[C.LISTITEM_IMG_E1]);

  // 38. サーキュレーション効果
  html.circuration_pic_url = PIC["サーキュレーション効果"]["楽天"];
  html.circuration_pic_alt = PIC["サーキュレーション効果"]["alt"];

  // 39. 明るさイメージ
  let hasBrithnessImage = false;
  if (_hasLight(rowdata)) {
    if (brightness_lumen < 300 || brightness_teido <= 10) {
      hasBrithnessImage = true;
      html.brithness_image_pic_url = PIC["明るさイメージ"]["楽天"];
      html.brithness_image_pic_alt = PIC["明るさイメージ"]["alt"];
    }
  }
  html.hasBrithnessImage = hasBrithnessImage;

  // 40. 取り付け画像(取付1〜5のうち最初に値のある列。29 とは対応する画像の組み合わせが異なる。GAS どおり)
  const toritukePic = rowdata[C.LISTITEM_TORITUKE1]
    ? "簡易取り付け_CF"
    : rowdata[C.LISTITEM_TORITUKE2]
      ? "簡易取付_YOWA_CF"
      : rowdata[C.LISTITEM_TORITUKE3]
        ? "一部電気工事_CF"
        : rowdata[C.LISTITEM_TORITUKE4]
          ? "電気工事必須_CF"
          : rowdata[C.LISTITEM_TORITUKE5]
            ? "その他取付_CF"
            : null;
  if (toritukePic) {
    html.toritukeUrl = PIC[toritukePic]["楽天"];
    html.toritukealt = PIC[toritukePic]["alt"];
  } else {
    html.toritukeUrl = "";
  }

  // 41. サブ紹介文
  html.subIntroduction = rowdata[C.LISTITEM_SUB_INTRODUCTION];

  return evaluateTemplate(CF_SALES_DESC_TEMPLATE, html);
}

function _hasLight(rowdata: Row): boolean {
  return !!(rowdata[CONFIG.CF_SHEET.LISTITEM_MODEL_NO_INTEGRATED_POS] || rowdata[CONFIG.CF_SHEET.LISTITEM_MODEL_NO_LIGHT_POS]);
}

// =====================================================================
// 楽天_PL販売用説明文.js
// =====================================================================

function _PLCreateHTML(ctx: RakutenCtx, rowdata: Row, shop_type: string): string {
  const P = CONFIG.PL_SHEET;
  const PIC = SHOP_DATA.COMMON_PIC;
  const html: Record<string, any> = {};

  // 01. 入荷待ちロゴ
  const nyuukamachi = rowdata[P.LISTITEM_ARRIVAL_SCHEDULE_POS];
  let nyuukayotei_logo_url = "";
  let nyuukayotei_logo_url_alt = "";
  if (nyuukamachi) {
    nyuukayotei_logo_url = PIC["入荷待ち"][shop_type];
    nyuukayotei_logo_url_alt = PIC["入荷待ち"]["alt"];
    html.awaitingStockMessage = rowdata[P.LISTITEM_ARRIVAL_AWAITING_STOCK_MESSAGE];
  }
  html.nyuukayotei_logo_url = nyuukayotei_logo_url;
  html.nyuukayotei_logo_url_alt = nyuukayotei_logo_url_alt;

  // 01. 商品情報
  const fazoo_unique_no = rowdata[P.LISTITEM_FAZOO_UNIQUE_NO_POS];
  html.product_info = fazoo_unique_no + " " + rowdata[P.LISTITEM_PRODUCT_COMMENT_POS];

  // 02. 取り付けタイプ画像(画像の辞書に無い設置タイプは GAS と同じく例外)
  const instalation_type = rowdata[P.LISTITEM_INSTALLATION_TYPE_POS];
  const instration_type_pic_url = PIC[instalation_type][shop_type];
  const instration_type_pic_alt = PIC[instalation_type]["alt"];
  if (instration_type_pic_url !== "") {
    html.instration_type_pic_url = instration_type_pic_url;
    html.instration_type_pic_alt = instration_type_pic_alt;
  } else {
    html.instration_type_pic_url = "";
    html.instration_type_pic_alt = "";
  }

  // 03. 画像一覧
  const productName = _editRakutenPlProductName(rowdata);
  const imgUrlList: any[] = [];
  for (const imgPos of [P.LISTITEM_IMG_MAIN1, P.LISTITEM_IMG_I1, P.LISTITEM_IMG_I2, P.LISTITEM_IMG_I3, P.LISTITEM_IMG_I4,
    P.LISTITEM_IMG_I5, P.LISTITEM_IMG_I6, P.LISTITEM_IMG_I7, P.LISTITEM_IMG_I8, P.LISTITEM_IMG_I9, P.LISTITEM_IMG_I10,
    P.LISTITEM_IMG_I11, P.LISTITEM_IMG_I12, P.LISTITEM_IMG_I13, P.LISTITEM_IMG_I14, P.LISTITEM_IMG_I15, P.LISTITEM_IMG_S1,
    P.LISTITEM_IMG_S2, P.LISTITEM_IMG_F1, P.LISTITEM_IMG_F2, P.LISTITEM_IMG_F3, P.LISTITEM_IMG_F4, P.LISTITEM_IMG_F5,
    P.LISTITEM_IMG_F6]) {
    const imgName = rowdata[imgPos];
    if (imgName !== "") {
      const imgIdx = ctx.imgPl.findIndex((row) => row[1] === imgName);
      if (imgIdx !== -1) imgUrlList.push(ctx.imgPl[imgIdx][5]);
    }
  }
  html.imgUrlList = imgUrlList;
  html.productName = productName;

  // 04. メーカーロゴ、型番、取付タイプ(辞書に無いメーカーは例外)
  const makerId = rowdata[P.LISTITEM_MAKER_ID_POS];
  html.maker_log_url = CONFIG.PL_MAKER[makerId]["ロゴ"][shop_type];
  html.maker_name = CONFIG.PL_MAKER[makerId]["英名"];
  html.fazoo_unique_no = fazoo_unique_no;
  html.instration_type = instalation_type + "タイプ";

  const min_height = rowdata[P.LISTITEM_MIN_HEIGHT];
  const max_height = rowdata[P.LISTITEM_MAX_HEIGHT];
  let display_height = "";
  if (min_height && max_height && min_height < max_height) {
    display_height = min_height + "mm - " + max_height + "mm";
  } else if (!min_height && max_height) {
    display_height = max_height + "mm";
  } else if (min_height && min_height === max_height) {
    display_height = max_height + "mm";
  } else if (!min_height && !max_height) {
    ctx.warnings.push("エラー: 高さが入力されていません");
    display_height = "データなし";
  } else {
    ctx.warnings.push("全高の数値に不整合があります（最小 > 最大 など）");
    display_height = "入力エラー";
  }
  html.width = rowdata[P.LISTITEM_WIDTH_POS];
  html.depth = rowdata[P.LISTITEM_DEPTH_POS];
  html.height = rowdata[P.LISTITEM_HEIGHT_POS];
  html.bulbbase = rowdata[P.LISTITEM_BULBBASE_POS];
  html.display_height = display_height;
  html.bulb_type = rowdata[P.LISTITEM_LIGHT_TYPE_POS];
  html.dimming_type = rowdata[P.LISTITEM_DIMMING_TYPE];
  html.dimming_method = rowdata[P.LISTITEM_DIMMING_METHOD];

  // 機能詳細(数値のセルは GAS と同じく replace で例外)
  html.function_detail1 = rowdata[P.LISTITEM_FUNCTION_DETAIL1_POS].replace(/\r?\n/g, "\n<br>");
  html.function_detail2 = rowdata[P.LISTITEM_FUNCTION_DETAIL2_POS].replace(/\r?\n/g, "\n<br>");
  html.function_detail3 = rowdata[P.LISTITEM_FUNCTION_DETAIL3_POS].replace(/\r?\n/g, "\n<br>");
  html.function_detail4 = rowdata[P.LISTITEM_FUNCTION_DETAIL4_POS].replace(/\r?\n/g, "\n<br>");

  return evaluateTemplate(PL_SALES_DESC_TEMPLATE, html);
}

// =====================================================================
// 00)CommonLogic.js outputCSV の書式(カンマ・改行・ダブルクォートを含むときだけ引用、CRLF)
// =====================================================================
export function toRakutenCsvLine(row: any[]): string {
  return Array.from(row, (cell) => {
    let str = cell === null || cell === undefined ? "" : String(cell);
    if (str.includes(",") || str.includes("\n") || str.includes("\r") || str.includes('"')) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(",");
}

export function toRakutenCsvText(rows: any[][]): string {
  return rows.map(toRakutenCsvLine).join("\r\n");
}
