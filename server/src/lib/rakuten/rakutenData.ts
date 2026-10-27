// 楽天出力(GAS の移植)の入力と管理データの読み書き
// - 入力: 台帳の行(ledger_rows)。楽天シートと同じ並びにする(CF は台帳の「ダクトレール取り付け」列を除く)
// - 管理データ: 楽天SKU番号(rakuten_skus)・画像管理(rakuten_images)。初期値は楽天スプレッドシートから取り込む(scripts/import-rakuten-master.ts)
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import type { RakutenCtx, Row } from "./rakutenCsv.js";

export type RakutenBook = "CF" | "PL";

// 楽天シートの対象の台帳シート。PL は「ペンダントライト一覧」のみ(その他別管理一覧FS は楽天シートの並びと異なるため対象外)
const LEDGER_SHEET: Record<RakutenBook, string> = { CF: "シーリングファンデータ", PL: "ペンダントライト一覧" };
// CF の台帳には楽天シートに無い「ダクトレール取り付け」列(0始まり110)がある
const CF_EXTRA_COL = 110;

const SKU_HEADER = ["商品管理番号（商品URL）", "SKU管理番号", "システム連携用SKU番号", "バリエーション項目キー1", "バリエーション項目選択肢1"];

function reviveCell(v: unknown): unknown {
  if (v && typeof v === "object" && "$date" in (v as Record<string, unknown>)) return new Date(String((v as { $date: string }).$date));
  return v;
}

/** 台帳の行(登録フラグ○)を、楽天シートと同じ並びのセル配列で返す。商品はシート順、PL は商品内の行順 */
export async function loadLedgerRows(
  book: RakutenBook,
  where: Prisma.ProductWhereInput,
  onBatch: (rows: Array<{ productCode: string; skuCode: string | null; cells: Row }>) => Promise<void> | void,
  batchSize = 300
): Promise<void> {
  // PL ブックの商品コードは「XX-9999…」形式(ハイフンあり)。CF はハイフンなし
  const bookWhere: Prisma.ProductWhereInput =
    book === "PL" ? { productCode: { contains: "-" } } : { NOT: { productCode: { contains: "-" } } };
  const ids = await prisma.product.findMany({
    where: { AND: [where, bookWhere], deletedAt: null },
    select: { id: true, productCode: true },
    orderBy: [{ sheetRow: "asc" }, { id: "asc" }],
  });
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const codeOf = new Map(chunk.map((p) => [p.id, p.productCode]));
    const order = new Map(chunk.map((p, n) => [p.id, n]));
    const rows = await prisma.ledgerRow.findMany({
      where: { productId: { in: chunk.map((p) => p.id) }, sheet: LEDGER_SHEET[book], listed: true },
      orderBy: [{ productId: "asc" }, { rowNo: "asc" }],
    });
    rows.sort((a, b) => order.get(a.productId)! - order.get(b.productId)! || a.rowNo - b.rowNo);
    await onBatch(
      rows.map((r) => {
        let cells = (JSON.parse(r.cells) as unknown[]).map(reviveCell);
        if (book === "CF") cells = [...cells.slice(0, CF_EXTRA_COL), ...cells.slice(CF_EXTRA_COL + 1)];
        return { productCode: codeOf.get(r.productId)!, skuCode: r.skuCode, cells };
      })
    );
  }
}

/** 楽天SKU番号・画像管理を GAS のシートと同じ形で読む */
export async function loadRakutenCtx(): Promise<RakutenCtx & { skuCount: number }> {
  const [skus, images] = await Promise.all([
    prisma.rakutenSku.findMany({ orderBy: { id: "asc" } }),
    prisma.rakutenImage.findMany({ orderBy: [{ book: "asc" }, { sortNo: "asc" }] }),
  ]);
  const pad = (v: unknown[]) => Array.from({ length: Math.max(5, v.length) }, (_, i) => (v[i] == null ? "" : v[i]));
  const skuRows = [SKU_HEADER, ...skus.map((s) => pad(s.values as unknown[]))];
  const img = (b: RakutenBook) =>
    images
      .filter((i) => i.book === b && i.fileName !== "")
      .map((i) => [i.no ?? "", i.fileName, i.folder1 ?? "", i.folder2 ?? "", i.renamedName ?? "", i.path ?? ""]);
  return { skuRows, imgCf: img("CF"), imgPl: img("PL"), warnings: [], skuCount: skuRows.length };
}

/** CSV の新規登録で追記された SKU を保存する(ctx.skuRows のうち読み込み後に増えた行) */
export async function saveNewSkus(ctx: RakutenCtx & { skuCount: number }): Promise<number> {
  const added = ctx.skuRows.slice(ctx.skuCount);
  if (added.length === 0) return 0;
  await prisma.rakutenSku.createMany({ data: added.map((values) => ({ values: values as Prisma.InputJsonValue })) });
  return added.length;
}
