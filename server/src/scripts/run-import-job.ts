// Cloud Run ジョブ(product-db-import)の入口: 取込ジョブを1件実行して終了する
// サービス(lib/importJobs.ts)が DB にジョブを登録し、ブックをストレージ(GCS)に置いてから、
// 環境変数 IMPORT_JOB_ID を指定してこのジョブを起動する。進捗・結果は DB の import_jobs に書く。
// ローカルで動きを確かめるとき: npx tsx src/scripts/run-import-job.ts <ジョブID>
import { runImportJobById } from "../lib/importJobs.js";
import { prisma } from "../lib/prisma.js";

const jobId = process.env.IMPORT_JOB_ID ?? process.argv[2];
if (!jobId) {
  console.error("IMPORT_JOB_ID(またはコマンド引数)でジョブIDを指定してください");
  process.exit(1);
}

let exitCode = 0;
try {
  const job = await runImportJobById(jobId);
  console.log(
    JSON.stringify({ jobId, status: job.status, book: job.bookType, total: job.total, created: job.created, updated: job.updated, softDeleted: job.softDeleted, errors: job.errors.length })
  );
  if (job.status !== "DONE") exitCode = 1;
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  exitCode = 1;
} finally {
  await prisma.$disconnect();
}
process.exit(exitCode);
