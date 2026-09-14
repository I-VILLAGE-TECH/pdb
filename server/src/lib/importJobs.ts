// Excelインポートのジョブ実行（バックグラウンド）と進捗管理
// 差分更新: 商品コードでupsert（ファイルに無い既存商品はそのまま）
// 全入れ替え: upsert後、対象種別のうちファイルに無い既存商品を論理削除
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { extractWorkbook, type ProductJson } from "./excelExtract.js";

export type ImportMode = "diff" | "replace";

export type ImportJob = {
  id: string;
  fileName: string;
  bookType?: "PL" | "CF";
  mode: ImportMode;
  status: "PARSING" | "RUNNING" | "DONE" | "ERROR";
  total: number;
  processed: number;
  created: number;
  updated: number;
  softDeleted: number;
  errors: string[];
  startedAt: string;
  finishedAt?: string;
  triggeredBy: string;
};

const jobs = new Map<string, ImportJob>();

// 実行履歴はDBへ永続化する（進捗のリアルタイム値はメモリ優先）
async function persistJob(job: ImportJob): Promise<void> {
  const data = {
    fileName: job.fileName,
    bookType: job.bookType ?? null,
    mode: job.mode,
    status: job.status,
    total: job.total,
    processed: job.processed,
    created: job.created,
    updated: job.updated,
    softDeleted: job.softDeleted,
    errors: job.errors,
    triggeredBy: job.triggeredBy,
    startedAt: new Date(job.startedAt),
    finishedAt: job.finishedAt ? new Date(job.finishedAt) : null,
  };
  await prisma.importJob
    .upsert({ where: { id: job.id }, create: { id: job.id, ...data }, update: data })
    .catch((e) => console.error("import job persist failed:", e));
}

function rowToJob(row: {
  id: string;
  fileName: string;
  bookType: string | null;
  mode: string;
  status: string;
  total: number;
  processed: number;
  created: number;
  updated: number;
  softDeleted: number;
  errors: unknown;
  triggeredBy: string;
  startedAt: Date;
  finishedAt: Date | null;
}): ImportJob {
  return {
    id: row.id,
    fileName: row.fileName,
    bookType: (row.bookType as "PL" | "CF" | null) ?? undefined,
    mode: row.mode as ImportMode,
    status: row.status as ImportJob["status"],
    total: row.total,
    processed: row.processed,
    created: row.created,
    updated: row.updated,
    softDeleted: row.softDeleted,
    errors: (row.errors as string[]) ?? [],
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString(),
    triggeredBy: row.triggeredBy,
  };
}

export async function getJob(id: string): Promise<ImportJob | undefined> {
  const live = jobs.get(id);
  if (live) return live;
  const row = await prisma.importJob.findUnique({ where: { id } });
  return row ? rowToJob(row) : undefined;
}

export async function listJobs(): Promise<ImportJob[]> {
  const rows = await prisma.importJob.findMany({ orderBy: { startedAt: "desc" }, take: 30 });
  // 実行中ジョブはメモリの最新進捗で上書き
  return rows.map((row) => jobs.get(row.id) ?? rowToJob(row));
}

function clean(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

async function runImport(job: ImportJob, buffer: Buffer): Promise<void> {
  const { bookType, products, makers } = extractWorkbook(buffer);
  job.bookType = bookType;
  job.total = products.length;
  job.status = "RUNNING";
  await persistJob(job);

  // メーカー（既存は上書きしない: 運用で編集した名称を守る）
  const makerMap = new Map<string, number>();
  for (const m of makers) {
    const maker = await prisma.maker.upsert({
      where: { makerCode: m.makerCode },
      create: { makerCode: m.makerCode, nameJp: m.nameJp, nameEn: m.nameEn, imgFolder: m.imgFolder },
      update: {},
    });
    makerMap.set(m.makerCode, maker.id);
  }

  const channels = await prisma.channel.findMany();
  const channelByCode = new Map(channels.map((c) => [c.code, c.id]));
  const existingCodes = new Set(
    (
      await prisma.product.findMany({ select: { productCode: true } })
    ).map((p) => p.productCode)
  );

  for (const p of products) {
    try {
      const {
        makerCode,
        lightingAttrs,
        fanAttrs,
        images = [],
        variations = [],
        setComponents = [],
        channelPrices = [],
        ...productFields
      } = p as ProductJson;

      const data = clean({
        ...productFields,
        makerId: makerCode ? (makerMap.get(makerCode as string) ?? null) : null,
        releaseDate: p.releaseDate ? new Date(p.releaseDate as string) : null,
        deletedAt: null, // 再登場した商品は論理削除を解除
      }) as unknown as Prisma.ProductUncheckedCreateInput;

      const isNew = !existingCodes.has(p.productCode);
      const product = await prisma.product.upsert({
        where: { productCode: p.productCode },
        create: data,
        update: data,
      });

      if (lightingAttrs) {
        const attrs = clean(lightingAttrs) as Prisma.ProductLightingAttrsUncheckedCreateInput;
        await prisma.productLightingAttrs.upsert({
          where: { productId: product.id },
          create: { ...attrs, productId: product.id },
          update: attrs,
        });
      }
      if (fanAttrs) {
        const attrs = clean(fanAttrs) as Prisma.ProductFanAttrsUncheckedCreateInput;
        await prisma.productFanAttrs.upsert({
          where: { productId: product.id },
          create: { ...attrs, productId: product.id },
          update: attrs,
        });
      }

      await prisma.productImage.deleteMany({ where: { productId: product.id } });
      if (images.length > 0) {
        await prisma.productImage.createMany({
          data: images.map((img) => ({
            ...(clean(img) as Prisma.ProductImageCreateManyInput),
            productId: product.id,
          })),
        });
      }

      for (const v of variations) {
        const vData = clean(v) as Prisma.ProductVariationUncheckedCreateInput;
        await prisma.productVariation.upsert({
          where: { skuCode: v.skuCode as string },
          create: { ...vData, productId: product.id },
          update: { ...vData, productId: product.id },
        });
      }

      await prisma.setComponent.deleteMany({ where: { setProductId: product.id } });
      if (setComponents.length > 0) {
        await prisma.setComponent.createMany({
          data: setComponents.map((c, i) => ({
            ...(clean(c) as Prisma.SetComponentCreateManyInput),
            setProductId: product.id,
            sortNo: i + 1,
          })),
        });
      }

      for (const cp of channelPrices) {
        const channelId = channelByCode.get(cp.channelCode);
        if (!channelId) continue;
        await prisma.productChannelPrice.upsert({
          where: { productId_channelId: { productId: product.id, channelId } },
          create: { productId: product.id, channelId, price: cp.price },
          update: { price: cp.price },
        });
      }

      if (isNew) job.created++;
      else job.updated++;
    } catch (e) {
      const message = e instanceof Error ? (e.message.split("\n").pop() ?? e.message) : String(e);
      job.errors.push(`${p.productCode}: ${message}`);
    }
    job.processed++;
    if (job.processed % 200 === 0) await persistJob(job); // 途中経過も定期的に保存
  }

  // 全入れ替え: 取り込んだ種別のうち、ファイルに無い既存商品を論理削除
  if (job.mode === "replace") {
    const importedCodes = products.map((p) => p.productCode);
    const importedCategories = [...new Set(products.map((p) => p.category))] as Array<
      "PENDANT_LIGHT" | "CEILING_LIGHT" | "CEILING_FAN" | "OTHER"
    >;
    const result = await prisma.product.updateMany({
      where: {
        category: { in: importedCategories },
        productCode: { notIn: importedCodes },
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
    job.softDeleted = result.count;
  }

  job.status = "DONE";
  job.finishedAt = new Date().toISOString();
  await persistJob(job);
  jobs.delete(job.id); // 以後はDBの履歴を参照
}

export function startImportJob(
  fileName: string,
  buffer: Buffer,
  mode: ImportMode,
  triggeredBy: string
): ImportJob {
  const job: ImportJob = {
    id: randomUUID(),
    fileName,
    mode,
    status: "PARSING",
    total: 0,
    processed: 0,
    created: 0,
    updated: 0,
    softDeleted: 0,
    errors: [],
    startedAt: new Date().toISOString(),
    triggeredBy,
  };
  jobs.set(job.id, job);
  void persistJob(job);

  runImport(job, buffer).catch(async (e) => {
    job.status = "ERROR";
    job.errors.push(e instanceof Error ? e.message : String(e));
    job.finishedAt = new Date().toISOString();
    await persistJob(job);
    jobs.delete(job.id);
  });

  return job;
}
