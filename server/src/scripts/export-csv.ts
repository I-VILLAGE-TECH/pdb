// エクスポート画面と同じ生成処理でCSVを1ファイル(分割なし)に書き出すCLI。並行出力比較(tools/csv-compare)用
// 実行: npx tsx src/scripts/export-csv.ts --type <fileType> --book PL|CF --out <出力パス> [--channel futureshop]
//   --type: products(既定) / option_basic / category 等(routes/exports.ts の fileType)
//   --book: 対象ブック。PL=「XX-9999」形式の商品コード、CF=それ以外(シーリングファン一覧)
import { writeFileSync } from "node:fs";
import { prisma } from "../lib/prisma.js";
import { generateRows, buildCsvText, encodeCsv, type Filter } from "../routes/exports.js";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

const fileType = arg("type", "products") as Filter["fileType"];
const book = arg("book");
const out = arg("out");
const channelCode = arg("channel", "futureshop")!;
if (!out || (book !== "PL" && book !== "CF")) {
  console.error("usage: export-csv.ts --type <fileType> --book PL|CF --out <file> [--channel futureshop]");
  process.exit(1);
}

const channel = await prisma.channel.findUniqueOrThrow({ where: { code: channelCode } });
const live = await prisma.product.findMany({ where: { deletedAt: null }, select: { productCode: true } });
const productCodes = live
  .map((p) => p.productCode)
  .filter((c) => /^[A-Z]+-\d/.test(c) === (book === "PL"));

const started = Date.now();
const { header, rows } = await generateRows({ channelId: channel.id, productCodes, fileType });
writeFileSync(out, encodeCsv(channel.charset === "SHIFT_JIS", buildCsvText(header, rows)));
console.log(`${fileType} ${book}: ${rows.length} rows -> ${out} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
await prisma.$disconnect();
