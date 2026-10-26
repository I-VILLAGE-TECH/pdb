// Yahoo 向けファイルの出力定義(現行マクロの再現)。仕組みは lib/mallCsv.ts を参照
// - PL(ペンダントライト一覧): 「Yahoo 在庫変更/生産終了」(★YA_Quantity_Del) = 在庫CSV + 削除CSV、
//   「Yahoo 販売価格変更」(★YA_Price) = 価格CSV。いずれも行単位(バリエーション=シートの1行)で出す。999行ごとに分割
// - CF(シーリングファン一覧): 「CSV_yahoo」(SetSelectRangeCSV_yahoo) = 商品本体54列 + 在庫 + 削除。分割なし
//   商品本体の各列は lib/mall/yahooCf.ts
import type { MallFileFormat, MallFileSpec, MallSetSpec, ProductFull } from "../mallCsv.js";
import { yahooCfAddRow, yahooCfIsAddTarget, yahooCfIsDeleteTarget, yahooCfQuantityRows, YAHOO_CF_ADD_HEADER } from "./yahooCf.js";

// 現行は Excel の「CSV(カンマ区切り)」保存: cp932・CRLF・必要時のみ "" で囲む
const EXCEL_CSV: MallFileFormat = { delimiter: ",", quote: "auto", charset: "SHIFT_JIS", extension: "csv" };

const QUANTITY_HEADER = ["code", "sub-code", "quantity", "allow-overdraft", "stock-close"];
const DELETE_HEADER = ["path", "name", "code", "price", "sale-price"];

// PL のファイル名は yyyymmddhhmm(12桁)。分割時は _1.._N
const plName = (base: string) => (stamp: string, index: number | null) =>
  `${base}${stamp.slice(0, 12)}${index == null ? "" : `_${index}`}`;

type Variation = ProductFull["variations"][number];
// PL: シートの行(登録フラグ○の行)をシート順で。行=バリエーション
// 現行マクロはペンダントライト一覧シートでのみ動く(その他別管理一覧FSシートの商品は対象外)
function plListedRows(products: ProductFull[]): Array<{ p: ProductFull; v: Variation }> {
  const out: Array<{ p: ProductFull; v: Variation }> = [];
  for (const p of products) {
    if ((p.extra as Record<string, unknown> | null)?.sheet === "other") continue;
    for (const v of p.variations) if (v.listed) out.push({ p, v });
  }
  return out;
}

const PL_SPLIT = 999; // SPLIT_DATA_YA_QUA / SPLIT_DATA_YA_DEL

export const YAHOO_FILE_SPECS: MallFileSpec[] = [
  // ---------- PL ----------
  {
    channel: "yahoo",
    fileType: "pl_quantity",
    label: "PL 在庫データ(quantity)",
    book: "PL",
    format: EXCEL_CSV,
    splitRows: PL_SPLIT,
    fileName: plName("Yahoo在庫データ_quantity_"),
    header: QUANTITY_HEADER,
    // 在庫は固定値: 入荷待ち○ → 0/在庫超過注文0、それ以外 → 99/1(SetQuantityCSV_Yahoo)
    generate: (products) =>
      plListedRows(products).map(({ v }) => [v.skuCode, "", v.backorder ? "0" : "99", v.backorder ? "0" : "1", ""]),
  },
  {
    channel: "yahoo",
    fileType: "pl_delete",
    label: "PL 商品データ削除(delete)",
    book: "PL",
    format: EXCEL_CSV,
    splitRows: PL_SPLIT,
    fileName: plName("Yahoo商品データ削除_delete_"),
    header: DELETE_HEADER,
    // 登録フラグ○かつ販売終了○の行(現行は確認ダイアログで「はい」を選んだ場合)
    generate: (products) =>
      plListedRows(products)
        .filter(({ v }) => v.eosFlag)
        .map(({ v }) => ["", "", v.skuCode, "", ""]),
  },
  {
    channel: "yahoo",
    fileType: "pl_price",
    label: "PL 価格データ(price)",
    book: "PL",
    format: EXCEL_CSV,
    splitRows: PL_SPLIT,
    fileName: plName("Yahoo価格データ_price_"),
    header: DELETE_HEADER,
    // 現行(SetPrice_Yahoo)は出力行の判定列の誤りで全行が2行目に上書きされ、商品コードも path 列に入る不具合がある。
    // ここでは全行を出し、商品コードは code 列に入れる(不具合は再現しない)。価格は行の合計商品価格
    generate: (products) =>
      plListedRows(products).map(({ p, v }) => ["", "", v.skuCode, String(v.price ?? p.totalPrice ?? ""), ""]),
  },
  // ---------- CF ----------
  {
    channel: "yahoo",
    fileType: "cf_data_add",
    label: "CF 商品データ(data_add)",
    book: "CF",
    format: EXCEL_CSV,
    fileName: (stamp) => `data_add${stamp}`,
    header: YAHOO_CF_ADD_HEADER,
    generate: (products) => products.filter(yahooCfIsAddTarget).map(yahooCfAddRow),
  },
  {
    channel: "yahoo",
    fileType: "cf_quantity",
    label: "CF 在庫データ(quantity)",
    book: "CF",
    format: EXCEL_CSV,
    fileName: (stamp) => `quantity${stamp}`,
    header: QUANTITY_HEADER,
    generate: (products) => products.filter(yahooCfIsAddTarget).flatMap(yahooCfQuantityRows),
  },
  {
    channel: "yahoo",
    fileType: "cf_data_del",
    label: "CF 削除データ(data_del)",
    book: "CF",
    format: EXCEL_CSV,
    fileName: (stamp) => `data_del${stamp}`,
    header: DELETE_HEADER,
    generate: (products) => products.filter(yahooCfIsDeleteTarget).map((p) => ["", "", p.productCode, "", ""]),
  },
];

export const YAHOO_SET_SPECS: MallSetSpec[] = [
  {
    channel: "yahoo",
    fileType: "pl_quantity_del",
    label: "PL 在庫変更/生産終了(在庫+削除)",
    book: "PL",
    members: ["pl_quantity", "pl_delete"],
    zipName: (stamp) => `Yahoo在庫変更_生産終了_${stamp.slice(0, 12)}`,
  },
  {
    channel: "yahoo",
    fileType: "cf_csv_yahoo",
    label: "CF CSV_yahoo(商品+在庫+削除)",
    book: "CF",
    members: ["cf_data_add", "cf_quantity", "cf_data_del"],
    zipName: (stamp) => `CSV_yahoo_${stamp}`,
  },
];
