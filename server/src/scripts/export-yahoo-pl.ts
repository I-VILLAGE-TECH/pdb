// Yahoo PL の CSV を DB(取込済みの台帳の行)から全件出力する(並行比較用)
// 実行: npx tsx src/scripts/export-yahoo-pl.ts --type yahoo_new_pl|yahoo_price_pl|yahoo_stock_pl|yahoo_eol_pl --out <dir> [--sjis]
//   既定は比較用に UTF-8 で書く。--sjis を付けると画面のダウンロードと同じ Shift_JIS
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma.js";
import { findYahooPlFileType, generateYahooPlCsv } from "../lib/yahoo/yahooPlExport.js";

const args = process.argv.slice(2);
const opt = (k: string) => args[args.indexOf(k) + 1];
const spec = findYahooPlFileType(opt("--type"));
const out = opt("--out");
if (!spec || !out) {
  console.error("usage: export-yahoo-pl.ts --type <yahoo_new_pl|yahoo_price_pl|yahoo_stock_pl|yahoo_eol_pl> --out <dir> [--sjis]");
  process.exit(1);
}
const started = Date.now();
const sjis = args.includes("--sjis");
const r = await generateYahooPlCsv(spec.key, {}, { encoding: sjis ? "Shift_JIS" : "utf8" });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, `${spec.key}${sjis ? "_sjis" : ""}.csv`), r.body!);
if (r.errors.length) fs.writeFileSync(path.join(out, `${spec.key}_errors.txt`), r.errors.join("\n") + "\n");
console.log(`${spec.key}: ${r.total} 行 / 出力しなかった行 ${r.errors.length} / 警告 ${r.warnings.length} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
await prisma.$disconnect();
