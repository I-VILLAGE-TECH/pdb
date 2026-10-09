// 現行ブック(.xlsm / .xlsb)をWeb画面のインポートと同じ処理でDBへ取り込むCLI
// 実行: npx tsx src/scripts/import-excel.ts <ブックのパス> [--replace]
//   --replace: 全入れ替え(取り込んだ種別のうちファイルに無い既存商品を論理削除)。既定は差分更新
import { readFileSync } from "node:fs";
import path from "node:path";
import { startImportJob, getJob } from "../lib/importJobs.js";
import { prisma } from "../lib/prisma.js";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: import-excel.ts <book.xlsm|xlsb> [--replace]");
  process.exit(1);
}
const mode = args.includes("--replace") ? "replace" : "diff";

const job = startImportJob(path.basename(file), readFileSync(file), mode, "cli");
let last = "";
for (;;) {
  await new Promise((r) => setTimeout(r, 1000));
  const j = await getJob(job.id);
  if (!j) continue;
  const line = `${j.status} ${j.processed}/${j.total}`;
  if (line !== last) console.log(line);
  last = line;
  if (j.status === "DONE" || j.status === "ERROR") {
    console.log(
      `book=${j.bookType} created=${j.created} updated=${j.updated} softDeleted=${j.softDeleted} errors=${j.errors.length}`
    );
    for (const e of j.errors.slice(0, 20)) console.log(`  ${e}`);
    break;
  }
}
await prisma.$disconnect();
