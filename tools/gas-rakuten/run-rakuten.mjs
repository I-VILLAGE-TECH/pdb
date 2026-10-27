// 現行の楽天 GAS を手元のデータで実行し、楽天 CSV(正解)を書き出す
// 使い方:
//   node tools/gas-rakuten/run-rakuten.mjs --gas <GASフォルダ> --book <（楽天）商品情報更新データ作成.xlsx>
//        --out <出力フォルダ> [--pl-ledger <ペンダントライト一覧.xlsm>] [--cf-ledger <シーリングファン一覧.xlsb>]
//   --pl-ledger / --cf-ledger を付けると、楽天シートに貼られた行の代わりに台帳の全行(登録フラグ○)を入力にする
//   (CF の台帳は「ダクトレール取り付け」列(110)が楽天シートに無いため、その列を除いて渡す)
// 出力: <out>/{cf,pl}_{new,price}.csv(UTF-8。GAS は Shift_JIS で保存するが、比較は文字列で行う)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createGasContext, FakeSheet } from "./gasRuntime.mjs";

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

const CF = "シーリングファン";
const PL = "ペンダントライト";
const book = readRows(args.book, [CF, PL, "楽天SKU番号", "画像管理(CF)", "画像管理(PL)", "画像リネーム失敗"]);

function sheetRows(name) {
  const header = book[name].slice(0, 4);
  let data = book[name].slice(4);
  if (name === PL && args["pl-ledger"]) {
    const l = readRows(args["pl-ledger"], ["ペンダントライト一覧"])["ペンダントライト一覧"];
    data = l.slice(3).filter((r) => r[0] === "○"); // 台帳は3行目まで見出し
  }
  if (name === CF && args["cf-ledger"]) {
    const l = readRows(args["cf-ledger"], ["シーリングファンデータ"])["シーリングファンデータ"];
    data = l.slice(1).filter((r) => r[0] === "○").map((r) => [...r.slice(0, 110), ...r.slice(111)]);
  } else {
    data = data.filter((r) => r.some((v) => v !== ""));
  }
  return [...header, ...data];
}

const summary = [];
for (const [name, key] of [[CF, "cf"], [PL, "pl"]]) {
  for (const operate of ["new", "price"]) {
    const sheets = {
      [CF]: new FakeSheet(CF, name === CF ? sheetRows(CF) : book[CF]),
      [PL]: new FakeSheet(PL, name === PL ? sheetRows(PL) : book[PL]),
      "楽天SKU番号": new FakeSheet("楽天SKU番号", book["楽天SKU番号"]),
      "画像管理(CF)": new FakeSheet("画像管理(CF)", book["画像管理(CF)"]),
      "画像管理(PL)": new FakeSheet("画像管理(PL)", book["画像管理(PL)"]),
      "画像リネーム失敗": new FakeSheet("画像リネーム失敗", book["画像リネーム失敗"]),
    };
    const { gas, outputs, alerts } = createGasContext(args.gas, sheets, name);
    const data = sheets[name].getDataRange().getValues().slice(gas.CONFIG.COMMON_SHEET_ITEM.OUTPUT_NON_TARGET_LINE);
    // GAS は1件でも止まるデータ(辞書に無いメーカー等)があると全体が止まる。正解作りでは1行ずつ実行し、止まった行は記録して続ける
    const rows = [];
    const errors = [];
    for (const row of data) {
      try {
        const r = gas.convertRakutenCsv(name, [row], operate === "price" ? "価格更新" : undefined);
        if (rows.length === 0) rows.push(r[0]); // 見出し行
        rows.push(...r.slice(1));
      } catch (e) {
        const code = row[name === CF ? gas.CONFIG.CF_SHEET.LISTITEM_PRODUCT_MANAGE_ID_POS : gas.CONFIG.PL_SHEET.LISTITEM_PRODUCT_MANAGE_ID_POS];
        errors.push(`${code}\t${String(e.message ?? e).split("\n")[0]}`);
      }
    }
    if (errors.length) fs.writeFileSync(path.join(args.out, `${key}_${operate}_errors.txt`), errors.join("\n") + "\n");
    gas.outputCSV(rows, "out", `${key}_${operate}_`, false);
    const text = outputs.at(-1).text;
    fs.writeFileSync(path.join(args.out, `${key}_${operate}.csv`), text);
    const added = sheets["楽天SKU番号"].rows.length - book["楽天SKU番号"].length;
    summary.push(`${key}_${operate}: 入力 ${data.length} 行 → CSV ${rows.length} 行 / 停止 ${errors.length} 行 / 新規SKU ${added} / 警告 ${alerts.length}`);
    if (alerts.length) fs.writeFileSync(path.join(args.out, `${key}_${operate}_alerts.txt`), alerts.join("\n"));
  }
}
console.log(summary.join("\n"));
