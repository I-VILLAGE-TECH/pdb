// 楽天 CSV を DB(取込済みの台帳の行・楽天の管理データ)から全件出力する(並行比較用)
// 実行: npx tsx src/scripts/export-rakuten.ts --type rakuten_new_cf|rakuten_price_cf|rakuten_new_pl|rakuten_price_pl --out <dir> [--persist]
//   --persist を付けると新規 SKU を楽天SKU番号に保存する(画面のダウンロードと同じ)。比較では付けない
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma.js";
import { findRakutenFileType, generateRakutenCsv } from "../lib/rakuten/rakutenExport.js";

const args = process.argv.slice(2);
const opt = (k: string) => args[args.indexOf(k) + 1];
const spec = findRakutenFileType(opt("--type"));
const out = opt("--out");
if (!spec || !out) {
  console.error("usage: export-rakuten.ts --type <rakuten_new_cf|rakuten_price_cf|rakuten_new_pl|rakuten_price_pl> --out <dir> [--persist]");
  process.exit(1);
}
const started = Date.now();
const r = await generateRakutenCsv(spec.key, {}, { persist: args.includes("--persist"), encoding: "utf8" });
fs.mkdirSync(out, { recursive: true });
// 比較用に UTF-8 で書く(画面のダウンロードは Shift_JIS)
fs.writeFileSync(path.join(out, `${spec.key}.csv`), r.body!);
if (r.errors.length) fs.writeFileSync(path.join(out, `${spec.key}_errors.txt`), r.errors.join("\n") + "\n");
console.log(`${spec.key}: ${r.total} 行 / 出力できなかった行 ${r.errors.length} / 警告 ${r.warnings.length} / 新規SKU保存 ${r.newSkus} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
await prisma.$disconnect();
