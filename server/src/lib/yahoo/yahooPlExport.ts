// Yahoo PL の CSV 出力(CSV 出力画面の「Yahoo!ショッピング」・ペンダントライトのタブ)。Yahoo(PL)スプレッドシートの「CSV出力実行」に相当
// - 入力は台帳「ペンダントライト一覧」の行(登録フラグ○。楽天と同じ ledger_rows)
// - 新規登録で例外の出た行(説明文のバイト数超過等)は出力せず errors に回す(GAS の「CSV出力エラー」シートと同じ)
// - 全件だと新規登録の CSV が 30MB 前後になるため、行は持ち続けずにまとまりごとに文字コードを変換して積み上げる
import type { Prisma } from "@prisma/client";
import { loadLedgerRows } from "../rakuten/rakutenData.js";
import { encodeSjisLikeGas } from "../rakuten/rakutenExport.js";
import { convertYahooCsv, toYahooCsvLine, type YahooCtx, type YahooOperate } from "./yahooPlCsv.js";

// ファイル名の接頭辞は GAS(CONFIG_YAHOO.OUTPUT_CSV_YAHOO_FILE_NAME)と同じ。在庫変更・生産終了は ReadMe に無い操作(GAS のコードにはある)
export const YAHOO_PL_FILE_TYPES = [
  { key: "yahoo_new_pl", label: "PL 新規登録・更新(data_add_pl)", operate: "新規登録", prefix: "data_add_pl" },
  { key: "yahoo_price_pl", label: "PL 価格更新(data_price_pl)", operate: "価格更新", prefix: "data_price_pl" },
  { key: "yahoo_stock_pl", label: "PL 在庫変更(quantity_pl)", operate: "在庫変更", prefix: "quantity_pl" },
  { key: "yahoo_eol_pl", label: "PL 生産終了(data_del_pl)", operate: "生産終了", prefix: "data_del_pl" },
] as const;
export type YahooPlFileType = (typeof YAHOO_PL_FILE_TYPES)[number]["key"];

export function findYahooPlFileType(key: string | undefined) {
  return YAHOO_PL_FILE_TYPES.find((t) => t.key === key);
}

export type YahooPlResult = {
  header: string[];
  rows: unknown[][]; // 先頭 keepRows 行(プレビュー用)
  total: number; // CSV の行数(見出しを除く)
  body: Buffer | null; // CSV ファイルの中身(encoding 指定時)
  errors: string[]; // 出力しなかった行(商品管理番号: 理由)
  warnings: string[]; // 全高の未入力等(GAS の console.error)
};

export async function generateYahooPlCsv(
  fileType: YahooPlFileType,
  where: Prisma.ProductWhereInput,
  opts: {
    keepRows?: number; // 結果に残す行数(既定 0)
    encoding?: "Shift_JIS" | "utf8"; // 指定すると CSV ファイルの中身を作る(GAS は Shift_JIS)
    onProgress?: (processed: number) => void;
  }
): Promise<YahooPlResult> {
  const spec = findYahooPlFileType(fileType)!;
  const operate = spec.operate as YahooOperate;
  const ctx: YahooCtx = { errors: [], warnings: [] };
  const header: string[] = convertYahooCsv(ctx, [], operate)[0];
  const keepRows = opts.keepRows ?? 0;
  const rows: unknown[][] = [];
  const chunks: Buffer[] = [];
  const encode = (text: string) => {
    if (opts.encoding) chunks.push(opts.encoding === "utf8" ? Buffer.from(text, "utf8") : encodeSjisLikeGas(text));
  };
  // GAS の outputCSV と同じく、行は CRLF でつなぎ、末尾に改行を付けない
  encode(toYahooCsvLine(header));
  let total = 0;
  let processed = 0;
  await loadLedgerRows("PL", where, async (batch) => {
    const out = convertYahooCsv(ctx, batch.map((r) => r.cells), operate).slice(1);
    for (const row of out) if (rows.length < keepRows) rows.push(row);
    if (opts.encoding && out.length) encode("\r\n" + out.map(toYahooCsvLine).join("\r\n"));
    total += out.length;
    processed += batch.length;
    opts.onProgress?.(processed);
    await new Promise((res) => setImmediate(res));
  });
  // 説明文は PC 用・スマホ用で2回作るため、同じ警告が2回出る。1回にまとめる
  const warnings = [...new Set(ctx.warnings)];
  return { header, rows, total, body: opts.encoding ? Buffer.concat(chunks) : null, errors: ctx.errors, warnings };
}

/** ファイル名は GAS と同じ {接頭辞}{yyyyMMddHHmmss}.csv */
export function yahooPlCsvFileName(fileType: YahooPlFileType, stamp14: string): string {
  return `${findYahooPlFileType(fileType)!.prefix}${stamp14}.csv`;
}
