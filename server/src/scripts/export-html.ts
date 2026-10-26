// HTML出力(SPEC / 製品画像)を画面と同じ生成処理でフォルダへ書き出すCLI。正解HTMLとの全件比較用
// 実行: npx tsx src/scripts/export-html.ts --type pl_spec|cf_original_spec --out <出力フォルダ>
//   出力: <out>/spec, <out>/spec_other (PL) / <out>/original, <out>/spec (CF)
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma.js";
import { generateHtml, HTML_TYPES, type HtmlType } from "../lib/html/index.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const type = arg("type") as HtmlType | undefined;
const out = arg("out");
if (!type || !(type in HTML_TYPES) || !out) {
  console.error("usage: export-html.ts --type pl_spec|cf_original_spec --out <dir>");
  process.exit(1);
}
const started = Date.now();
const r = await generateHtml(type, {});
for (const f of r.files) {
  const dir = path.join(out, f.folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, f.name), f.body);
}
console.log(`${type}: ${r.files.length} files, skipped ${r.skipped}, errors ${r.errors.length} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
for (const e of r.errors.slice(0, 30)) console.log(`  ${e}`);
await prisma.$disconnect();
