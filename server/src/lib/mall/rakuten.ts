// 楽天 向けファイルの出力定義(現行マクロの再現)。仕組みは lib/mallCsv.ts を参照
//
// 現行VBA:
//   CF(シーリングファン一覧) ボタン「CSV_楽天」= rakuten.bas の runRakutenMacro
//     → rakuten_variation_csv(バリエーション在庫8列) → rakuten_csv(単品7列) の順に出力
//   PL(ペンダントライト一覧) ボタン「楽天」= ★rakuten.bas の rakuten_csv
//     → item-delete.csv(削除) → rakuten_「生産終了用」商品更新_*.csv → rakuten_商品更新_*.csv
// いずれも作業シート(楽天_単品 / 楽天_バリエーション出力)に値を置いてから Print # でカンマ連結して書く。
// そのためクォートなし・Shift_JIS(ANSI)・CRLF。値は Cell.Value の文字列化(数値はそのまま、日付文字列は日付型→yyyy/mm/dd)。
// ヘッダー文言とデータの意味のズレ・IIf の両分岐同値も現行どおり再現する(業務確認事項)。
// 生セルは取込(excelExtract.ts)で extra.rakutenCells / rakutenVariationMaster(CF)、extra.rakutenRows(PL)に保持している。
import type { MallFileFormat, MallFileSpec, MallSetSpec, ProductFull } from "../mallCsv.js";

type Raw = string | number | boolean | null | undefined;

const FORMAT: MallFileFormat = { delimiter: ",", quote: "none", charset: "SHIFT_JIS", lineEnd: "\r\n", extension: "csv" };

// VBA の CStr(Cell.Value) 相当。数値は有効15桁(Excel/VBAの表示精度)、真偽は True/False、空は ""
function vbaStr(v: Raw): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") {
    if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
    return String(Number(v.toPrecision(15)));
  }
  return v;
}

// 本日(JST) yyyy/mm/dd。VBA は Format(Now,"yyyy/mm/dd") をセルに入れ(日付型に変換される)、出力時に短い日付形式で文字列化
function todayJst(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 10).replace(/-/g, "/");
}

// yyyymmddHHMMSS → yyyymmdd_HHMMSS(VBA の Format(Now,"yyyymmdd_hhmmss"))
function stampUs(stamp: string): string {
  return `${stamp.slice(0, 8)}_${stamp.slice(8, 14)}`;
}

function extraOf(p: ProductFull): Record<string, unknown> {
  const e = p.extra;
  return e && typeof e === "object" && !Array.isArray(e) ? (e as Record<string, unknown>) : {};
}

// ---------- CF(rakuten.bas) ----------

type CfCells = { a: Raw; c: Raw; p: Raw; ad: Raw; ae: Raw; af: Raw; ao: Raw; au: Raw };
type CfMasterRow = { a: Raw; b: Raw; f: Raw; h: Raw; j: Raw; u: Raw };

function cfCells(p: ProductFull): CfCells | null {
  const c = extraOf(p).rakutenCells;
  return c && typeof c === "object" ? (c as CfCells) : null;
}

// 商品登録フラグ○の行(選択範囲=渡された商品。非表示行はDBでは判別できないため全行対象)
function cfTargets(products: ProductFull[]): Array<{ p: ProductFull; c: CfCells }> {
  const out: Array<{ p: ProductFull; c: CfCells }> = [];
  for (const p of products) {
    const c = cfCells(p);
    if (c && vbaStr(c.a) === "○") out.push({ p, c });
  }
  return out;
}

// AD<>"" And AE<>"" → バリエーションあり(runRakutenMacro の hasVariation 判定)
function cfHasVariation(c: CfCells): boolean {
  return vbaStr(c.ad) !== "" && vbaStr(c.ae) !== "";
}
// AD="" Or (AD<>"" And AE="" And AF="") → 単品(hasBlank 判定・rakuten_csv の対象)
// ※ AD・AF に値があり AE が空の行はどちらにも該当しない(現行どおり)
function cfIsBlank(c: CfCells): boolean {
  const ad = vbaStr(c.ad);
  return ad === "" || (ad !== "" && vbaStr(c.ae) === "" && vbaStr(c.af) === "");
}

// rakuten_csv: 単品の商品更新CSV(7列)。楽天_単品シート A〜G
function cfItemRows(products: ProductFull[]): string[][] {
  const today = todayJst();
  const rows: string[][] = [];
  for (const { c } of cfTargets(products)) {
    if (!cfIsBlank(c)) continue;
    const status = vbaStr(c.c);
    const code = vbaStr(c.p);
    let stock: string; // C: 在庫数
    let warehouse: string; // D: 倉庫指定
    if (status === "生産終了") {
      stock = "0";
      warehouse = "1";
    } else if (status === "在庫切れ" || status === "即日切れ") {
      stock = "0";
      warehouse = "0";
    } else {
      stock = "99";
      warehouse = "0";
    }
    // F: 表示価格(AO)。オープン価格 "O" は -1(2025/10/15 変更。バリエーションは open)
    const listPrice = vbaStr(c.ao) === "O" ? "-1" : vbaStr(c.ao);
    rows.push([code, code, stock, warehouse, today, listPrice, vbaStr(c.au)]);
  }
  return rows;
}

// rakuten_variation_csv: バリエーション在庫CSV(8列)。楽天_バリエーション出力シート A〜H
// runRakutenMacro は hasVariation(○行に AD・AE とも値ありの行がある)のときだけ呼ぶ。
// 呼ばれた場合は○行すべて(単品も)を楽天_バリエーションマスタで検索し、一致した全行を出す
function cfVariationRows(products: ProductFull[]): string[][] {
  const targets = cfTargets(products);
  if (!targets.some(({ c }) => cfHasVariation(c))) return [];
  const rows: string[][] = [];
  for (const { p, c } of targets) {
    const status = vbaStr(c.c);
    const masters = (extraOf(p).rakutenVariationMaster ?? []) as CfMasterRow[];
    for (const m of masters) {
      let stock: string; // E: 在庫数(マスタJ列は常に上書きされる)
      let warehouse = vbaStr(m.u); // F: 倉庫指定(マスタU列。生産終了/在庫切れ/即日切れのときだけ上書き)
      if (status === "生産終了") {
        stock = "0";
        warehouse = "1";
      } else if (status === "在庫切れ" || status === "即日切れ") {
        stock = "0";
        warehouse = "0";
      } else {
        stock = "99";
      }
      const listPrice = vbaStr(c.ao) === "O" ? "open" : vbaStr(c.ao);
      rows.push([vbaStr(m.a), vbaStr(m.b), vbaStr(m.f), vbaStr(m.h), stock, warehouse, listPrice, vbaStr(c.au)]);
    }
  }
  return rows;
}

// ---------- PL(★rakuten.bas) ----------

type PlRow = { row: number; a: Raw; d: Raw; e: Raw; s: Raw; aw: Raw; ac: Raw };

// メインシート(ペンダントライト一覧)の行をシート順に。wsSource が固定のため その他別管理一覧FS は対象外
// 販売終了(E)○ → 生産終了対象行、それ以外で投入フラグ(A)○ → 商品更新対象行
function plRows(products: ProductFull[]): { eos: PlRow[]; upd: PlRow[] } {
  const all: PlRow[] = [];
  for (const p of products) {
    const list = extraOf(p).rakutenRows;
    if (Array.isArray(list)) all.push(...(list as PlRow[]));
  }
  all.sort((x, y) => x.row - y.row);
  const eos: PlRow[] = [];
  const upd: PlRow[] = [];
  for (const r of all) {
    if (vbaStr(r.e) === "○") eos.push(r);
    else if (vbaStr(r.a) === "○") upd.push(r);
  }
  return { eos, upd };
}

// 生産終了マクロ: item-delete.csv(商品管理番号のみ。S列が空の行は出さない)
function plDeleteRows(products: ProductFull[]): string[][] {
  return plRows(products)
    .eos.map((r) => vbaStr(r.s))
    .filter((s) => s !== "")
    .map((s) => [s]);
}

// 生産終了_商品更新マクロ: A=S, B=S, C=IIf(E="○",0,99)=0, D=本日, E=IIf(E="○",1,1)=1, F・G=空
function plEosUpdateRows(products: ProductFull[]): string[][] {
  const today = todayJst();
  return plRows(products).eos.map((r) => [
    vbaStr(r.s),
    vbaStr(r.s),
    vbaStr(r.e) === "○" ? "0" : "99",
    today,
    "1", // IIf の両分岐が 1(現行どおり)
    "",
    "",
  ]);
}

// 商品更新マクロ: A=S, B=S, C=IIf(D="○",0,99), D=本日, E=IIf(D="○",0,0)=0, F=AW(販売価格合計), G=AC(定価。"O"も変換しない)
function plUpdateRows(products: ProductFull[]): string[][] {
  const today = todayJst();
  return plRows(products).upd.map((r) => [
    vbaStr(r.s),
    vbaStr(r.s),
    vbaStr(r.d) === "○" ? "0" : "99",
    today,
    "0", // IIf の両分岐が 0(現行どおり)
    vbaStr(r.aw),
    vbaStr(r.ac),
  ]);
}

// PL の WriteCsvFile の固定ヘッダー(データは 在庫数,日付,倉庫0/1,販売価格合計,定価 の順でヘッダーとズレている)
const PL_UPDATE_HEADER = ["商品コード（楽天URL）", "楽天商品番号", "在庫数", "付箋2", "倉庫", "販売価格", "表示価格"];

export const RAKUTEN_FILE_SPECS: MallFileSpec[] = [
  {
    channel: "rakuten",
    fileType: "cf_variation",
    label: "CF バリエーション在庫CSV(rakuten_variation_csv)",
    book: "CF",
    format: FORMAT,
    fileName: (stamp) => `rakuten_variation_csv_${stampUs(stamp)}`,
    header: [
      "メインデータの商品コード（楽天URL）",
      "メインデータの商品名",
      "項目選択肢別在庫用横軸選択肢",
      "項目選択肢別在庫用縦軸選択肢",
      "項目選択肢別在庫用在庫数",
      "楽天　倉庫指定",
      "表示価格",
      "販売価格",
    ],
    generate: (products) => cfVariationRows(products),
  },
  {
    channel: "rakuten",
    fileType: "cf_item",
    label: "CF 単品 商品更新CSV(rakuten_csv)",
    book: "CF",
    format: FORMAT,
    fileName: (stamp) => `rakuten_csv_${stampUs(stamp)}`,
    header: ["商品コード（楽天URL）", "楽天商品番号", "在庫数", "倉庫指定", "付箋1", "表示価格", "販売価格"],
    generate: (products) => cfItemRows(products),
  },
  {
    channel: "rakuten",
    fileType: "pl_delete",
    label: "PL 削除CSV(item-delete)",
    book: "PL",
    format: FORMAT,
    fileName: () => "item-delete",
    header: ["商品管理番号（商品URL）"],
    generate: (products) => plDeleteRows(products),
  },
  {
    channel: "rakuten",
    fileType: "pl_eos_update",
    label: "PL 生産終了用 商品更新CSV",
    book: "PL",
    format: FORMAT,
    fileName: (stamp) => `rakuten_「生産終了用」商品更新_${stampUs(stamp)}`,
    header: PL_UPDATE_HEADER,
    generate: (products) => plEosUpdateRows(products),
  },
  {
    channel: "rakuten",
    fileType: "pl_update",
    label: "PL 商品更新CSV",
    book: "PL",
    format: FORMAT,
    fileName: (stamp) => `rakuten_商品更新_${stampUs(stamp)}`,
    header: PL_UPDATE_HEADER,
    generate: (products) => plUpdateRows(products),
  },
];

export const RAKUTEN_SET_SPECS: MallSetSpec[] = [
  {
    channel: "rakuten",
    fileType: "cf_set",
    label: "CSV_楽天(CF: バリエーション在庫+単品)",
    book: "CF",
    members: ["cf_variation", "cf_item"],
    zipName: (stamp) => `rakuten_CF_${stampUs(stamp)}`,
  },
  {
    channel: "rakuten",
    fileType: "pl_set",
    label: "楽天(PL: 削除+生産終了用更新+商品更新)",
    book: "PL",
    members: ["pl_delete", "pl_eos_update", "pl_update"],
    zipName: (stamp) => `rakuten_PL_${stampUs(stamp)}`,
  },
];
