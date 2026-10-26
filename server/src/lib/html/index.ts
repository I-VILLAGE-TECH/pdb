// HTML出力(現行マクロの SPEC / Original&Spec)の種別と生成。画面(routes/htmlExports.ts)と比較用CLIで共用する
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { cfHtmlTarget, cfOriginalHtml, cfSpecHtml } from "./cfHtml.js";
import { plSpecHtml, type HtmlFile } from "./plSpecHtml.js";

export type { HtmlFile };

// pl_spec: ペンダントライト SPEC(★FS_SPEC)。ZIP内は spec/ (メインシート) と spec_other/ (その他別管理一覧FS)
// cf_original / cf_spec: シーリングファン 製品画像 / SPEC(Original＆Spec ボタン)。ZIP内は original/ と spec/
export const HTML_TYPES = {
  pl_spec: { label: "ペンダントライト SPEC HTML", book: "PL" },
  cf_original_spec: { label: "シーリングファン 製品画像・SPEC HTML", book: "CF" },
} as const;
export type HtmlType = keyof typeof HTML_TYPES;

export const isPlCode = (code: string) => /^[A-Z]+-\d/.test(code);

export type HtmlResult = {
  files: Array<HtmlFile & { folder: string }>;
  errors: string[]; // 現行マクロなら停止するデータ(出力しない)
  skipped: number; // 登録フラグが対象外
};

const include = {
  maker: true,
  lightingAttrs: true,
  fanAttrs: true,
  variations: { orderBy: { variationNo: "asc" } },
  images: true,
  channelPrices: true,
  setComponents: true,
} satisfies Prisma.ProductInclude;

// 商品を BATCH 件ずつ読んで生成する(全件を一度に読むと Cloud Run のメモリ 512MiB を超えるため)。
// 生成したファイルは onFile に渡す(画面は ZIP へ順に書き出す)。戻り値はデータ不備と対象外の件数
const BATCH = 200;

export async function forEachHtml(
  type: HtmlType,
  where: Prisma.ProductWhereInput,
  onFile: (file: HtmlFile & { folder: string }) => Promise<void> | void
): Promise<Omit<HtmlResult, "files"> & { count: number }> {
  const result = { errors: [] as string[], skipped: 0, count: 0 };
  const run = (code: string, fn: () => Array<HtmlFile & { folder: string }> | null) => {
    try {
      return fn();
    } catch (e) {
      result.errors.push(`${code}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  };
  // PLブックの商品コードは「XX-9999…」(ハイフンあり)、CFブックは「XXX999」。DB側で大まかに絞ってから isPlCode で確定する
  const bookWhere: Prisma.ProductWhereInput =
    type === "pl_spec" ? { productCode: { contains: "-" } } : { NOT: { productCode: { contains: "-" } } };
  for (let skip = 0; ; skip += BATCH) {
    const products = await prisma.product.findMany({
      where: { AND: [where, bookWhere], deletedAt: null },
      include,
      orderBy: [{ sheetRow: "asc" }, { id: "asc" }],
      skip,
      take: BATCH,
    });
    if (products.length === 0) break;
    for (const p of products) {
      if (isPlCode(p.productCode) !== (type === "pl_spec")) continue;
      let files: Array<HtmlFile & { folder: string }> | null;
      if (type === "pl_spec") {
        files = run(p.productCode, () => {
          const f = plSpecHtml(p);
          if (!f) return [];
          const other = ((p.extra ?? {}) as Record<string, unknown>).sheet === "other";
          return [{ ...f, folder: other ? "spec_other" : "spec" }];
        });
        if (files && files.length === 0) result.skipped++;
      } else {
        if (!cfHtmlTarget(p)) {
          result.skipped++;
          continue;
        }
        files = run(p.productCode, () => [
          { ...cfOriginalHtml(p), folder: "original" },
          { ...cfSpecHtml(p), folder: "spec" },
        ]);
      }
      for (const f of files ?? []) {
        await onFile(f);
        result.count++;
      }
    }
    if (products.length < BATCH) break;
  }
  return result;
}

// 全件をメモリに集める版(比較用CLI)
export async function generateHtml(type: HtmlType, where: Prisma.ProductWhereInput): Promise<HtmlResult> {
  const files: HtmlResult["files"] = [];
  const r = await forEachHtml(type, where, (f) => {
    files.push(f);
  });
  return { files, errors: r.errors, skipped: r.skipped };
}
