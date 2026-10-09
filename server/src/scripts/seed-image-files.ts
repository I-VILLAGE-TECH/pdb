// 画像ファイルの縦横px(image_files)を投入する。futureshop 商品CSV(CF)の独自コメント(13)等の width/height 用。
// 現行VBA(ImgFileInfo.bas CheckImageInfo/GetImageInfo)は画像実ファイルを読み、結果をブックの「ImgFileInfo」シートに
// キャッシュしている(以後はシートの値を使う)。画像ファイルは手元に無いため、次のいずれかから投入する。
//   npx tsx src/scripts/seed-image-files.ts <入力>... [--dry-run]
//   入力: .xlsb/.xlsx/.xlsm → 「ImgFileInfo」シート(A:ファイル名 D:Width E:Height)。VBAが実際に参照する値
//         .csv              → 現行VBA出力の FS商品CSV(cp932)。HTML内の <img data-src=".../ファイル名" ... width="W" height="H"> を抽出
// 複数指定時は後の入力が優先(上書き)。何度でも実行可(upsert)。
import fs from "node:fs";
import path from "node:path";
import iconv from "iconv-lite";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

type Size = { width: number; height: number };

function fromWorkbook(file: string): Map<string, Size> {
  const wb = XLSX.read(fs.readFileSync(file), { type: "buffer", sheets: ["ImgFileInfo"] });
  const ws = wb.Sheets["ImgFileInfo"];
  if (!ws) throw new Error(`${file}: 「ImgFileInfo」シートがありません`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
  const out = new Map<string, Size>();
  for (const r of rows.slice(1)) {
    const name = r[0] == null ? "" : String(r[0]);
    const w = Number(r[3]);
    const h = Number(r[4]);
    if (!name || !Number.isFinite(w) || !Number.isFinite(h)) continue;
    out.set(name, { width: Math.round(w), height: Math.round(h) });
  }
  return out;
}

// 対象は商品画像フォルダ(cf_item_img/<メーカー>/)のみ。共通パーツ(cf_img/products_detail 等)は固定値なので対象外
const IMG_RE = /(<div class="(?:main|thm)_slide">)?<img [^>]*?data-src="[^"]*\/cf_item_img\/[^"/]+\/([^"/]+)"[^>]*?\swidth="(\d*)" height="(\d*)"/g;

function fromCsv(file: string, conflicts: string[]): Map<string, Size> {
  // CSVのフィールド内は " が "" にエスケープされている。HTML抽出だけが目的なので単純に戻す
  const text = iconv.decode(fs.readFileSync(file), "cp932").replace(/""/g, '"');
  const out = new Map<string, Size>();
  for (const m of text.matchAll(IMG_RE)) {
    const [, slide, name, w, h] = m;
    // スライダー(独自コメント12)は実寸ではなく固定 768x500 / 100x100 で出るため除外
    if (slide || w === "" || h === "") continue;
    const size = { width: Number(w), height: Number(h) };
    const prev = out.get(name);
    if (prev && (prev.width !== size.width || prev.height !== size.height)) {
      conflicts.push(`${name}: ${prev.width}x${prev.height} / ${size.width}x${size.height}`);
    }
    out.set(name, size);
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry-run");
  const files = args.filter((a) => !a.startsWith("--"));
  if (files.length === 0) {
    console.error("usage: seed-image-files.ts <ImgFileInfoシートを含むブック | FS商品CSV>... [--dry-run]");
    process.exit(1);
  }
  const all = new Map<string, Size>();
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    const conflicts: string[] = [];
    const m = ext === ".csv" ? fromCsv(f, conflicts) : fromWorkbook(f);
    console.log(`${path.basename(f)}: ${m.size}件`);
    if (conflicts.length) console.warn(`  同一ファイル名でサイズ不一致 ${conflicts.length}件 例: ${conflicts.slice(0, 3).join(", ")}`);
    for (const [k, v] of m) all.set(k, v);
  }
  console.log(`合計 ${all.size}件${dry ? " (dry-run: 書き込みなし)" : ""}`);
  if (dry) return;
  const prisma = new PrismaClient();
  try {
    const entries = [...all];
    const CHUNK = 500;
    for (let i = 0; i < entries.length; i += CHUNK) {
      await prisma.$transaction(
        entries.slice(i, i + CHUNK).map(([fileName, s]) =>
          prisma.imageFile.upsert({
            where: { fileName },
            create: { fileName, width: s.width, height: s.height },
            update: { width: s.width, height: s.height },
          })
        )
      );
    }
    console.log(`upsert 完了: ${entries.length}件 (image_files 総数 ${await prisma.imageFile.count()})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
