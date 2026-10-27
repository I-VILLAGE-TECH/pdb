// 楽天スプレッドシートの管理データ(楽天SKU番号・画像管理(CF)・画像管理(PL))を取り込む(初回移行用)
// 実行: npx tsx src/scripts/import-rakuten-master.ts <（楽天）商品情報更新データ作成.xlsx> [--replace]
//   既にデータがある場合は --replace を付けたときだけ全件入れ替える(システムで追記した SKU・画像も消えるため注意)
// スプレッドシートは「ファイル → ダウンロード → Microsoft Excel」で保存したもの
import XLSX from "xlsx";
import { prisma } from "../lib/prisma.js";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const replace = args.includes("--replace");
if (!file) {
  console.error("usage: import-rakuten-master.ts <（楽天）商品情報更新データ作成.xlsx> [--replace]");
  process.exit(1);
}

type Cell = string | number | boolean | Date | null;
const wb = XLSX.readFile(file, { sheets: ["楽天SKU番号", "画像管理(CF)", "画像管理(PL)"], cellDates: true });
const rowsOf = (name: string): Cell[][] => {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`シート「${name}」が見つかりません`);
  return XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: "", blankrows: true });
};
const str = (v: Cell) => (v == null || v === "" ? null : v instanceof Date ? v.toISOString() : String(v));

async function main() {
  const [skuCount, imgCount] = await Promise.all([prisma.rakutenSku.count(), prisma.rakutenImage.count()]);
  if ((skuCount || imgCount) && !replace) {
    throw new Error(`既に楽天の管理データがあります(SKU ${skuCount} 件・画像 ${imgCount} 件)。入れ替える場合は --replace を付けてください`);
  }

  // 楽天SKU番号: 見出し行を除き、空行は飛ばす。値はセルの型のまま(GAS はセルの型で厳密比較する)
  const skus = rowsOf("楽天SKU番号")
    .slice(1)
    .filter((r) => r.slice(0, 5).some((v) => v !== ""))
    .map((r) => Array.from({ length: 5 }, (_, i) => {
      const v = r[i];
      return v instanceof Date ? v.toISOString() : v ?? "";
    }));

  // 画像管理: 2行目から。ファイル名(B列)が空の行は GAS も読まないため飛ばす。ファイルパス(F列)は数式の計算結果
  const images = (["CF", "PL"] as const).flatMap((book) =>
    rowsOf(`画像管理(${book})`)
      .slice(1)
      .filter((r) => r[1] !== "" && r[1] != null)
      .map((r, i) => ({
        book,
        sortNo: i + 1,
        no: typeof r[0] === "number" ? r[0] : r[0] === "" ? null : Number(r[0]) || null,
        fileName: String(r[1]),
        folder1: str(r[2]),
        folder2: str(r[3]),
        renamedName: str(r[4]),
        path: str(r[5]),
      }))
  );

  await prisma.$transaction([
    prisma.rakutenSku.deleteMany(),
    prisma.rakutenImage.deleteMany(),
    prisma.rakutenSku.createMany({ data: skus.map((values) => ({ values })) }),
    prisma.rakutenImage.createMany({ data: images }),
  ]);
  console.log(
    `楽天SKU番号 ${skus.length} 件、画像管理(CF) ${images.filter((i) => i.book === "CF").length} 件、画像管理(PL) ${images.filter((i) => i.book === "PL").length} 件を取り込みました`
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
