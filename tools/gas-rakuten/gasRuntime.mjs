// 楽天スプレッドシートの GAS(Apps Script)を Node で動かすための最小限の代用品。
// GAS のコードは変更せずに読み込み、SpreadsheetApp・HtmlService・Utilities・DriveApp を差し替える。
// 用途: 現行 GAS の出力(正解)を手元のデータで再現し、product-db の楽天出力と並行比較する
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

// ---- シート(getValues は GAS と同じく空セルは "" ) ----
export class FakeSheet {
  constructor(name, rows) {
    this.name = name;
    this.rows = rows.map((r) => [...r]);
  }
  getName() { return this.name; }
  getSheetName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map((r) => r.length)); }
  getDataRange() { return this.getRange(1, 1, this.rows.length, this.getLastColumn()); }
  getRange(row, col, numRows = 1, numCols = 1) {
    const sheet = this;
    return {
      getValues() {
        const out = [];
        for (let r = 0; r < numRows; r++) {
          const src = sheet.rows[row - 1 + r] ?? [];
          const line = [];
          for (let c = 0; c < numCols; c++) {
            const v = src[col - 1 + c];
            line.push(v === undefined || v === null ? "" : v);
          }
          out.push(line);
        }
        return out;
      },
      getValue() { return this.getValues()[0][0]; },
      setValues(values) {
        values.forEach((line, r) => {
          const dst = (sheet.rows[row - 1 + r] ??= []);
          line.forEach((v, c) => { dst[col - 1 + c] = v; });
        });
        return this;
      },
      setValue(v) { return this.setValues([[v]]); },
    };
  }
  appendRow(values) { this.rows.push([...values]); return this; }
}

// ---- HtmlService のテンプレート(<? ?> / <?= ?> / <?!= ?>) ----
function escapeHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function compileTemplate(src) {
  let code = "let __out='';\n";
  const re = /<\?(!=|=)?([\s\S]*?)\?>/g;
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    code += `__out+=${JSON.stringify(src.slice(last, m.index))};\n`;
    if (m[1] === "=") code += `__out+=__esc(${m[2]});\n`;
    else if (m[1] === "!=") code += `__out+=String((${m[2]})??'');\n`;
    else code += m[2] + "\n";
    last = re.lastIndex;
    // ?> の直後の改行1つは出力しない(<? ?>・<?= ?> とも。実際の出力で確認。PHP の ?> と同じ)
    if (src.startsWith("\r\n", last)) last += 2;
    else if (src[last] === "\n") last += 1;
  }
  code += `__out+=${JSON.stringify(src.slice(last))};\nreturn __out;`;
  return new Function("__data", "__esc", `with(__data){\n${code}\n}`);
}

// ---- Utilities.formatDate(JST 固定) ----
function formatDate(date, _tz, fmt) {
  const d = new Date(date.getTime() + 9 * 3600 * 1000); // JST
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return fmt
    .replace(/yyyy/g, d.getUTCFullYear())
    .replace(/MM/g, p(d.getUTCMonth() + 1))
    .replace(/dd/g, p(d.getUTCDate()))
    .replace(/HH/g, p(d.getUTCHours()))
    .replace(/mm/g, p(d.getUTCMinutes()))
    .replace(/ss/g, p(d.getUTCSeconds()));
}

/**
 * GAS を読み込んだ実行環境を作る
 * @param gasDir GAS(.js / .html)を置いたフォルダ
 * @param sheets シート名 → FakeSheet
 * @param activeSheetName アクティブシート名
 */
export function createGasContext(gasDir, sheets, activeSheetName, fixedNow = new Date("2026-10-27T10:00:00+09:00")) {
  const outputs = []; // DriveApp に作られたファイル { folderId, name, text }
  const alerts = [];
  const spreadsheet = {
    getSheetByName: (n) => sheets[n] ?? null,
    getActiveSheet: () => sheets[activeSheetName],
    getId: () => "fake-spreadsheet",
  };
  const sandbox = {
    console: { log() {}, info() {}, warn() {}, error: (...a) => alerts.push(a.join(" ")) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      getUi: () => ({ alert: (m) => alerts.push(String(m)), ButtonSet: {}, Button: {} }),
    },
    Browser: { msgBox: (m) => alerts.push(String(m)) },
    Utilities: {
      formatDate,
      newBlob(data = "", contentType, name) {
        let text = typeof data === "string" ? data : "";
        return {
          getBytes: () => [...Buffer.from(text, "utf8")],
          setDataFromString(s) { text = s; return this; },
          getDataAsString: () => text,
          getName: () => name,
          __text: () => text,
        };
      },
    },
    HtmlService: {
      createTemplateFromFile(name) {
        const src = fs.readFileSync(path.join(gasDir, `${name}.html`), "utf8");
        const fn = compileTemplate(src);
        const tpl = {
          evaluate() {
            // HtmlService は評価結果から HTML コメント(<!-- -->)を取り除く(実際の出力 normal-item20261027193309.csv で確認)
            const content = fn({ ...tpl }, escapeHtml).replace(/<!--[\s\S]*?-->/g, "");
            return { getContent: () => content };
          },
        };
        return tpl;
      },
    },
    DriveApp: {
      getFolderById: (folderId) => ({
        createFile(blob) {
          outputs.push({ folderId, name: blob.getName(), text: blob.__text() });
        },
      }),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    Date: class extends Date {
      constructor(...a) { if (a.length === 0) super(fixedNow); else super(...a); }
      static now() { return fixedNow.getTime(); }
    },
  };
  vm.createContext(sandbox);
  // GAS は全ファイルが同じグローバルを共有する。const/let もファイルをまたいで見えるよう1本につなげて評価する
  const files = fs.readdirSync(gasDir).filter((f) => f.endsWith(".js")).sort();
  const src = files.map((f) => `// ---- ${f}\n${fs.readFileSync(path.join(gasDir, f), "utf8")}`).join("\n");
  vm.runInContext(`${src}\n;globalThis.__gas = { CTX, CONFIG, convertRakutenCsv, outputCSV };`, sandbox, { filename: "gas.js" });
  return { sandbox, gas: sandbox.__gas, outputs, alerts };
}
