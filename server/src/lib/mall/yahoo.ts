// Yahoo 向けファイルの出力定義(現行マクロの再現)。仕組みは lib/mallCsv.ts を参照
// - CF(シーリングファン一覧): 「CSV_yahoo」(SetSelectRangeCSV_yahoo) = 商品本体54列 + 在庫 + 削除。分割なし
//   商品本体の各列は lib/mall/yahooCf.ts
// - PL は現行では Excel マクロではなく Yahoo(PL)スプレッドシート(GAS)で出力している(2026-10-27 業務確認)。
//   GAS の移植は lib/yahoo/(Excel マクロ基準の PL 在庫・削除・価格は 2026-10-28 に削除)
import type { MallFileFormat, MallFileSpec, MallSetSpec } from "../mallCsv.js";
import { yahooCfAddRow, yahooCfIsAddTarget, yahooCfIsDeleteTarget, yahooCfQuantityRows, YAHOO_CF_ADD_HEADER } from "./yahooCf.js";

// 現行は Excel の「CSV(カンマ区切り)」保存: cp932・CRLF・必要時のみ "" で囲む
const EXCEL_CSV: MallFileFormat = { delimiter: ",", quote: "auto", charset: "SHIFT_JIS", extension: "csv" };

const QUANTITY_HEADER = ["code", "sub-code", "quantity", "allow-overdraft", "stock-close"];
const DELETE_HEADER = ["path", "name", "code", "price", "sale-price"];

export const YAHOO_FILE_SPECS: MallFileSpec[] = [
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
    fileType: "cf_csv_yahoo",
    label: "CF CSV_yahoo(商品+在庫+削除)",
    book: "CF",
    members: ["cf_data_add", "cf_quantity", "cf_data_del"],
    zipName: (stamp) => `CSV_yahoo_${stamp}`,
  },
];
