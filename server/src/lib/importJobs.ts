// Excelインポートのジョブ実行と進捗管理
// 差分更新: 商品コードでupsert（ファイルに無い既存商品はそのまま）
// 全入れ替え: upsert後、対象種別のうちファイルに無い既存商品を論理削除
//
// 実行場所は環境で切り替える（documents/03_設計/01_全体/06_連携エンジン・インフラ設計.md）
// - ローカル/Docker: 同じプロセスの中でバックグラウンド実行（進捗はメモリ優先＋DB）
// - GCP: 環境変数 IMPORT_JOB_NAME があれば、アップロードされたブックをストレージ(GCS)に置き、
//        Cloud Run ジョブ(scripts/run-import-job.ts)を起動する。進捗はジョブがDBへ書き、APIはDBを読む
//        (Cloud Run サービスは応答後にCPUが割り当てられないため、サービス内では処理しない)
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { extractWorkbook, type ProductJson } from "./excelExtract.js";
import { readFileBuffer, removeFile, saveFile } from "./storage.js";

export type ImportMode = "diff" | "replace";

export type ImportJob = {
  id: string;
  fileName: string;
  bookType?: "PL" | "CF";
  mode: ImportMode;
  status: "QUEUED" | "PARSING" | "RUNNING" | "DONE" | "ERROR";
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

// 実行中のまま一定時間を過ぎたジョブは、異常終了(メモリ超過・タイムアウト等でエラー記録前に落ちた)とみなす。
// Cloud Run ジョブのタスクタイムアウト(30分)より長くする
const STALE_MS = 40 * 60 * 1000;
const ACTIVE = new Set(["QUEUED", "PARSING", "RUNNING"]);

async function markStale(job: ImportJob): Promise<ImportJob> {
  if (!ACTIVE.has(job.status) || jobs.has(job.id)) return job;
  if (Date.now() - new Date(job.startedAt).getTime() < STALE_MS) return job;
  job.status = "ERROR";
  job.errors.push("取込が完了しないまま時間切れになりました(処理が異常終了した可能性があります)。もう一度実行してください");
  job.finishedAt = new Date().toISOString();
  await persistJob(job);
  return job;
}

export async function getJob(id: string): Promise<ImportJob | undefined> {
  const live = jobs.get(id);
  if (live) return live;
  const row = await prisma.importJob.findUnique({ where: { id } });
  return row ? markStale(rowToJob(row)) : undefined;
}

export async function listJobs(): Promise<ImportJob[]> {
  const rows = await prisma.importJob.findMany({ orderBy: { startedAt: "desc" }, take: 30 });
  // 実行中ジョブはメモリの最新進捗で上書き
  return Promise.all(rows.map((row) => jobs.get(row.id) ?? markStale(rowToJob(row))));
}

// PLブックの商品コードは「XX-9999…」形式、CFブックは「XXX999」形式
function isPlBookCode(code: string): boolean {
  return /^[A-Z]+-\d/.test(code);
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

      // シートから消えた行(SKU)は削除する(残すとバリエーションCSVに旧行が出る・枝番の一意制約に当たる)
      await prisma.productVariation.deleteMany({
        where: {
          productId: product.id,
          skuCode: { notIn: variations.map((v) => v.skuCode as string) },
        },
      });
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

  // 全入れ替え: 取り込んだブックの商品のうち、ファイルに無い既存商品を論理削除。
  // PLブックにもシーリングファン区分の商品があるため、カテゴリではなく商品コード形式(ブック)で範囲を決める
  if (job.mode === "replace") {
    const importedCodes = new Set(products.map((p) => p.productCode));
    const live = await prisma.product.findMany({
      where: { deletedAt: null },
      select: { id: true, productCode: true },
    });
    const staleIds = live
      .filter((p) => isPlBookCode(p.productCode) === (bookType === "PL"))
      .filter((p) => !importedCodes.has(p.productCode))
      .map((p) => p.id);
    const result = await prisma.product.updateMany({
      where: { id: { in: staleIds } },
      data: { deletedAt: new Date() },
    });
    job.softDeleted = result.count;
  }

  job.status = "DONE";
  job.finishedAt = new Date().toISOString();
  await persistJob(job);
  jobs.delete(job.id); // 以後はDBの履歴を参照
}

// ストレージ上のアップロード済みブックの置き場所(Cloud Run ジョブが読む)
function uploadKey(jobId: string): string {
  return `imports/${jobId}`;
}

async function failJob(job: ImportJob, e: unknown): Promise<void> {
  job.status = "ERROR";
  job.errors.push(e instanceof Error ? e.message : String(e));
  job.finishedAt = new Date().toISOString();
  await persistJob(job);
  jobs.delete(job.id);
}

// Cloud Run ジョブを起動する(ジョブIDを環境変数で渡す)。認証はメタデータサーバのトークン(サービスのSA)
async function triggerCloudRunJob(jobName: string, jobId: string): Promise<void> {
  const tokenRes = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    { headers: { "Metadata-Flavor": "Google" } }
  );
  if (!tokenRes.ok) throw new Error(`取込ジョブの起動に失敗しました(認証トークン取得: ${tokenRes.status})`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const res = await fetch(`https://run.googleapis.com/v2/${jobName}:run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      overrides: { containerOverrides: [{ env: [{ name: "IMPORT_JOB_ID", value: jobId }] }] },
    }),
  });
  if (!res.ok) throw new Error(`取込ジョブの起動に失敗しました(${res.status}): ${(await res.text()).slice(0, 300)}`);
}

export async function startImportJob(
  fileName: string,
  buffer: Buffer,
  mode: ImportMode,
  triggeredBy: string
): Promise<ImportJob> {
  // 同時実行はしない(同じブックを並行して取り込むと商品・SKUの更新が衝突する)
  const running = (await listJobs()).find((j) => ACTIVE.has(j.status));
  if (running) {
    throw Object.assign(new Error(`取込が実行中です(${running.fileName})。完了してから実行してください`), { status: 409 });
  }
  const job: ImportJob = {
    id: randomUUID(),
    fileName,
    mode,
    status: "QUEUED",
    total: 0,
    processed: 0,
    created: 0,
    updated: 0,
    softDeleted: 0,
    errors: [],
    startedAt: new Date().toISOString(),
    triggeredBy,
  };
  await persistJob(job);

  const jobName = process.env.IMPORT_JOB_NAME;
  if (jobName) {
    // GCP: ブックをストレージに置いて Cloud Run ジョブを起動
    try {
      await saveFile(uploadKey(job.id), buffer, "application/octet-stream");
      await triggerCloudRunJob(jobName, job.id);
    } catch (e) {
      await removeFile(uploadKey(job.id));
      await failJob(job, e);
    }
    return job;
  }

  // ローカル: 同じプロセスの中でバックグラウンド実行
  job.status = "PARSING";
  jobs.set(job.id, job);
  runImport(job, buffer).catch((e) => failJob(job, e));
  return job;
}

// Cloud Run ジョブ(scripts/run-import-job.ts)の本体: DBのジョブ行とストレージのブックから取込を実行する
export async function runImportJobById(jobId: string): Promise<ImportJob> {
  const row = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!row) throw new Error(`取込ジョブが見つかりません: ${jobId}`);
  const job = rowToJob(row);
  if (job.status !== "QUEUED") throw new Error(`取込ジョブが待機中ではありません: ${jobId} (${job.status})`);
  jobs.set(job.id, job);
  try {
    job.status = "PARSING";
    await persistJob(job);
    const buffer = await readFileBuffer(uploadKey(job.id));
    if (!buffer) throw new Error("アップロードされたファイルが見つかりません");
    await runImport(job, buffer);
  } catch (e) {
    await failJob(job, e);
  } finally {
    await removeFile(uploadKey(job.id));
  }
  return job;
}
