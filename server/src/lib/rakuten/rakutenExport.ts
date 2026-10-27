// 楽天 CSV の出力(CSV 出力画面の「楽天」)。GAS の「CSV出力実行」(新規商品登録CSV出力 / 価格更新CSV出力)に相当
// - GAS は1行でも例外が出ると全体が止まる。ここでは例外の出た行(商品)を出力せず errors に回し、残りは出力する
// - 新規登録で新しく採番した SKU は、ダウンロード時に楽天SKU番号へ保存する(プレビューでは保存しない)
// - 全件だと CSV が 30MB 前後になるため、行は持ち続けずに商品のまとまりごとに文字コードを変換して積み上げる
//   (Cloud Run のメモリ 512MiB に収める)。プレビューは先頭の数行だけを持つ
import iconv from "iconv-lite";
import type { Prisma } from "@prisma/client";
import { convertRakutenCsv, RAKUTEN_SHEET, toRakutenCsvLine } from "./rakutenCsv.js";
import { loadLedgerRows, loadRakutenCtx, saveNewSkus, type RakutenBook } from "./rakutenData.js";

export const RAKUTEN_FILE_TYPES = [
  { key: "rakuten_new_pl", label: "新規登録・更新(normal-item)", book: "PL", operate: "new" },
  { key: "rakuten_price_pl", label: "価格更新(normal-item)", book: "PL", operate: "price" },
  { key: "rakuten_new_cf", label: "新規登録・更新(normal-item)", book: "CF", operate: "new" },
  { key: "rakuten_price_cf", label: "価格更新(normal-item)", book: "CF", operate: "price" },
] as const;
export type RakutenFileType = (typeof RAKUTEN_FILE_TYPES)[number]["key"];

export function findRakutenFileType(key: string | undefined) {
  return RAKUTEN_FILE_TYPES.find((t) => t.key === key);
}

export type RakutenResult = {
  header: string[];
  rows: unknown[][]; // 先頭 keepRows 行(プレビュー用)
  total: number; // CSV の行数(見出しを除く)
  body: Buffer | null; // CSV ファイルの中身(encoding 指定時)
  errors: string[]; // 例外で出力できなかった行(商品管理番号: 理由)
  warnings: string[]; // 画像が画像管理に無い等(GAS の console.error)
  newSkus: number;
};

export async function generateRakutenCsv(
  fileType: RakutenFileType,
  where: Prisma.ProductWhereInput,
  opts: {
    persist: boolean; // 新規 SKU を保存する(ダウンロード時)
    keepRows?: number; // 結果に残す行数(既定 0)
    encoding?: "Shift_JIS" | "utf8"; // 指定すると CSV ファイルの中身を作る(GAS は Shift_JIS)
    onProgress?: (processed: number) => void;
  }
): Promise<RakutenResult> {
  const spec = findRakutenFileType(fileType)!;
  const book = spec.book as RakutenBook;
  const operate = spec.operate === "price" ? ("価格更新" as const) : undefined;
  const sheetName = book === "CF" ? RAKUTEN_SHEET.CF : RAKUTEN_SHEET.PL;
  const ctx = await loadRakutenCtx();
  const header: string[] = convertRakutenCsv(ctx, sheetName, [], operate)[0];
  const keepRows = opts.keepRows ?? 0;
  const rows: unknown[][] = [];
  const chunks: Buffer[] = [];
  const encode = (text: string) => {
    if (opts.encoding) chunks.push(opts.encoding === "utf8" ? Buffer.from(text, "utf8") : encodeSjisLikeGas(text));
  };
  // GAS の outputCSV と同じく、行は CRLF でつなぎ、末尾に改行を付けない
  encode(toRakutenCsvLine(header));
  const errors: string[] = [];
  let total = 0;
  let processed = 0;
  await loadLedgerRows(book, where, async (batch) => {
    const lines: string[] = [];
    for (const r of batch) {
      try {
        const out = convertRakutenCsv(ctx, sheetName, [r.cells], operate).slice(1);
        for (const row of out) {
          if (rows.length < keepRows) rows.push(row);
          if (opts.encoding) lines.push(toRakutenCsvLine(row));
        }
        total += out.length;
      } catch (e) {
        errors.push(`${r.skuCode ?? r.productCode}\t${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
      }
    }
    if (lines.length) encode("\r\n" + lines.join("\r\n"));
    processed += batch.length;
    opts.onProgress?.(processed);
    await new Promise((res) => setImmediate(res));
  });
  const newSkus = opts.persist && spec.operate === "new" ? await saveNewSkus(ctx) : 0;
  return {
    header,
    rows,
    total,
    body: opts.encoding ? Buffer.concat(chunks) : null,
    errors,
    warnings: ctx.warnings,
    newSkus,
  };
}

// GAS(setDataFromString(…, "Shift-JIS"))は JIS の対応表で変換するため、「〜」(U+301C)と「−」(U+2212)は
// 0x8160・0x817C になる。iconv-lite の Shift_JIS では「?」になるので、同じ符号になる全角文字に置き換えてから変換する
// (台帳の PL に実際に出てくる文字。本物の PL 出力での確認はまだ。Shift_JIS に無い文字(「蒅」等)は GAS と同じく「?」)
function encodeSjisLikeGas(text: string): Buffer {
  return iconv.encode(text.replace(/\u301C/g, "\uFF5E").replace(/\u2212/g, "\uFF0D"), "Shift_JIS");
}

/** ファイル名は GAS と同じ normal-item{yyyyMMddHHmmss}.csv */
export function rakutenCsvFileName(stamp14: string): string {
  return `normal-item${stamp14}.csv`;
}

/** エラー・警告の一覧(UTF-8 BOM 付き・CRLF。Windows のメモ帳で読めるように) */
export function buildRakutenReport(lines: string[]): Buffer {
  return Buffer.from("﻿" + lines.join("\r\n") + "\r\n", "utf8");
}
