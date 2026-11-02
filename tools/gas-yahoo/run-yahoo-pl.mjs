// 現行の Yahoo(PL)スプレッドシートの GAS を手元のデータで実行し、Yahoo PL の CSV と画像リネーム結果(正解)を書き出す
// 使い方:
//   node tools/gas-yahoo/run-yahoo-pl.mjs --gas <GASフォルダ> --book <（Yahooペンダントライト用）商品情報更新データ作成.xlsx>
//        --out <出力フォルダ> [--pl-ledger <ペンダントライト一覧.xlsm>]
//   --pl-ledger を付けると、シートに貼られた行の代わりに台帳の全行(登録フラグ○)を入力にする(並びは台帳と同じ)
// 出力: <out>/pl_{new,price,stock}.csv(UTF-8。GAS は Shift_JIS で保存するが、比較は文字列で行う)
//       <out>/pl_new_errors.txt(GAS が「CSV出力エラー」シートに書く、出力しなかった商品)
//       <out>/pl_images.txt(画像リネームのコピー先と元画像。元画像はすべてある前提)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createGasContext, FakeSheet } from "../gas-rakuten/gasRuntime.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../server/package.json"));
const XLSX = require("xlsx");

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);
for (const k of ["gas", "book", "out"]) if (!args[k]) throw new Error(`--${k} が必要です`);
fs.mkdirSync(args.out, { recursive: true });

const readRows = (file, sheetNames) => {
  const wb = XLSX.readFile(file, { sheets: sheetNames, cellDates: true });
  return Object.fromEntries(
    sheetNames.map((n) => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "", raw: true, blankrows: true })])
  );
};

const PL = "ペンダントライト";
const book = readRows(args.book, [PL]);
const header = book[PL].slice(0, 4);
let data = book[PL].slice(4).filter((r) => r.some((v) => v !== ""));
if (args["pl-ledger"]) {
  const l = readRows(args["pl-ledger"], ["ペンダントライト一覧"])["ペンダントライト一覧"];
  data = l.slice(3).filter((r) => r[0] === "○"); // 台帳は3行目まで見出し
}
const EXPORTS = ["CTX", "CONFIG", "CONFIG_RAKUTEN", "convertYahooCsv", "outputCSV", "syncAndZipYahooImages"];

const summary = [];
for (const [key, operate] of [["new", undefined], ["price", "価格更新"], ["stock", "在庫変更"]]) {
  const sheets = { [PL]: new FakeSheet(PL, [...header, ...data]) };
  const { gas, outputs, alerts } = createGasContext(args.gas, sheets, PL, undefined, EXPORTS);
  const rows = gas.convertYahooCsv(PL, data, operate);
  gas.outputCSV(rows, "out", `pl_${key}_`, false);
  fs.writeFileSync(path.join(args.out, `pl_${key}.csv`), outputs.at(-1).text);
  const errSheet = sheets["CSV出力エラー"];
  const errors = errSheet ? errSheet.rows.slice(1).map((r) => r.join("\t")) : [];
  if (errors.length) fs.writeFileSync(path.join(args.out, `pl_${key}_errors.txt`), errors.join("\n") + "\n");
  summary.push(`pl_${key}: 入力 ${data.length} 行 → CSV ${rows.length - 1} 行 / 出力しなかった商品 ${errors.length} / 警告 ${alerts.length}`);
}

// 画像リネーム(syncAndZipYahooImages)。Drive の代わりに、元画像フォルダには台帳に出てくる全ファイルがある前提で、コピーを記録する
{
  const sheets = { [PL]: new FakeSheet(PL, [...header, ...data]) };
  const copies = [];
  const names = new Set();
  const fileObj = (name) => ({ getName: () => name, getId: () => `id:${name}`, getBlob: () => ({ name }) });
  const folder = (id, files = []) => ({
    getId: () => id,
    getFiles: () => { let i = 0; return { hasNext: () => i < files.length, next: () => files[i++] }; },
    getFolders: () => ({ hasNext: () => false }),
    getFoldersByName: (n) => { let done = false; return { hasNext: () => !done, next: () => { done = true; return folder(n); } }; },
    createFolder: (n) => folder(n),
    createFile: () => {},
  });
  const { gas, sandbox } = createGasContext(args.gas, sheets, PL, undefined, EXPORTS);
  for (const pos of gas.CONFIG_RAKUTEN.IMG_PL_POS_LIST) for (const r of data) if (r[pos] && r[pos] !== "CUSTOM-SIZE") names.add(r[pos]);
  sandbox.PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => k }) };
  sandbox.DriveApp = { getFolderById: (id) => (id === "PL_ITEM_IMG" ? folder(id, [...names].map(fileObj)) : folder(id)) };
  sandbox.Drive = { Files: { copy: (meta, fileId) => copies.push(`${meta.parents[0]}/${meta.name}\t${fileId.slice(3)}`), remove: () => {} } };
  sandbox.Utilities.zip = () => ({});
  gas.syncAndZipYahooImages();
  fs.writeFileSync(path.join(args.out, "pl_images.txt"), copies.join("\n") + "\n");
  summary.push(`pl_images: コピー ${copies.length} 件`);
}
console.log(summary.join("\n"));
