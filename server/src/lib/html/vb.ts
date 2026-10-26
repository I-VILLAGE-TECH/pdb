// HTML出力でセル値を連結するときの VBA の変換規則(CStr・比較・Format)を再現する
export type CellValue = string | number | boolean | null | undefined;

// CStr: 数値は有効数字15桁(7.000000000000001 → "7")、真偽値は True/False、空セルは ""
export function vbStr(v: CellValue): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    const p = Number(v.toPrecision(15));
    return String(p);
  }
  return v;
}

// セル同士の = / <> (Variant 比較): 数値同士は数値で、数値と文字列は不一致、空セルは "" と等しい
export function vbEq(a: CellValue, b: CellValue): boolean {
  const ea = a == null || a === "";
  const eb = b == null || b === "";
  // 空セル(Empty)は "" とも 0 とも等しい
  if (ea || eb) return (ea && eb) || (ea && b === 0) || (eb && a === 0);
  if (typeof a === "number" && typeof b === "number") return a === b;
  if (typeof a === "number" || typeof b === "number") return false;
  return vbStr(a) === vbStr(b);
}

// 0 < セル: 数値(または数値に変換できる文字列)のときだけ正なら真
export function vbPositive(v: CellValue): boolean {
  if (typeof v === "number") return v > 0;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v) > 0;
  return false;
}

// 数値として扱えるか(Format は数値でない文字列をそのまま返す)
function toNum(v: CellValue): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? -1 : 0;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

// 四捨五入(0.5 は 0 から遠い方へ。VBA の Format と同じ)
function roundHalfUp(x: number, digits: number): number {
  const m = 10 ** digits;
  const r = Math.round(Math.abs(x) * m + 1e-9) / m;
  return x < 0 ? -r : r;
}

// Format(v, "0.0")
export function vbFormat01(v: CellValue): string {
  if (v == null || v === "") return "";
  const n = toNum(v);
  if (n == null) return vbStr(v);
  return roundHalfUp(n, 1).toFixed(1);
}

// Format(v, "#,##0円")
export function vbFormatYen(v: CellValue): string {
  if (v == null || v === "") return "";
  const n = toNum(v);
  if (n == null) return vbStr(v);
  const r = roundHalfUp(n, 0);
  return `${r.toLocaleString("en-US", { maximumFractionDigits: 0 })}円`;
}

// 改行(CRLF / CR / LF)を "<br>" + CRLF にそろえる(VBA の ▲■● 置換)
export function brLines(s: string): string {
  return s.replace(/\r\n|\r|\n/g, "<br>\r\n");
}

// VBA の配列 sJT(0..rowMax) を各行 + LF で書き出し、UTF-8(BOM付き)にする(ADODB.Stream の UTF-8 出力)
export function writeLines(lines: string[], rowMax: number): Buffer {
  if (lines.length > rowMax + 1) throw new Error(`行数が上限(${rowMax + 1})を超えています`);
  const all = [...lines, ...Array(rowMax + 1 - lines.length).fill("")];
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(all.map((l) => `${l}\n`).join(""), "utf8")]);
}
