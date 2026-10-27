// GAS の HtmlService テンプレート(<? code ?> / <?= 式 ?>(HTML エスケープ) / <?!= 式 ?>(そのまま))の評価。
// テンプレートに無い変数を参照すると ReferenceError になる(GAS と同じ。現行でも説明文が作れず CSV が止まる)
// HtmlService の癖(業務から受領した実際の出力 normal-item20261027193309.csv で確認):
// - ?> の直後の改行1つは出力しない(PHP の ?> と同じ)
// - 評価結果から HTML コメント(<!-- -->)を取り除く(コメントの後の改行は残る)
const cache = new Map<string, (data: Record<string, unknown>, esc: (v: unknown) => string) => string>();

function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function compile(src: string) {
  let code = "let __out='';\n";
  const re = /<\?(!=|=)?([\s\S]*?)\?>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    code += `__out+=${JSON.stringify(src.slice(last, m.index))};\n`;
    if (m[1] === "=") code += `__out+=__esc(${m[2]});\n`;
    else if (m[1] === "!=") code += `__out+=String((${m[2]})??'');\n`;
    else code += `${m[2]}\n`;
    last = re.lastIndex;
    if (src.startsWith("\r\n", last)) last += 2;
    else if (src[last] === "\n") last += 1;
  }
  code += `__out+=${JSON.stringify(src.slice(last))};\nreturn __out;`;
  // テンプレートの変数はプロパティとして渡す(with はモジュールの strict モードでは使えないため Function で評価する)
  return new Function("__data", "__esc", `with(__data){\n${code}\n}`) as (
    data: Record<string, unknown>,
    esc: (v: unknown) => string
  ) => string;
}

export function evaluateTemplate(src: string, data: Record<string, unknown>): string {
  let fn = cache.get(src);
  if (!fn) {
    fn = compile(src);
    cache.set(src, fn);
  }
  return fn({ ...data }, escapeHtml).replace(/<!--[\s\S]*?-->/g, "");
}
