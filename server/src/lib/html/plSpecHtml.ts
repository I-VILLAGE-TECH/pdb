// ペンダントライトの SPEC HTML(現行マクロ ★FS_SPEC: pendantlight/modules/futureshopSPEC.bas の Set_SpecTEXT)
// 1商品(fazoo管理型番 親)1ファイル。ペンダントライト一覧・その他別管理一覧FS の両シートが対象。
// 取込時に保持した各行の生セル(products.extra.specRows。キーはVBAの列番号)から、VBAと同じ連結でテキストを作る
import { brLines, vbEq, vbFormat01, vbPositive, vbStr, writeLines, type CellValue } from "./vb.js";

type Row = Record<string, CellValue>;
export type PlSpecSource = { productCode: string; extra: unknown };
export type HtmlFile = { name: string; body: Buffer };

const TEXT_ROW = 300;
const FS_CMS_ITEM_IMGPATH = "/pl_item_img/";

// 列番号(Common.bas の ICOL_*)
const C = {
  importFlag: 1,
  backorder: 4,
  eos: 5,
  itemType: 7,
  idFazoo: 17,
  makerJp: 21,
  mainGroup: 23,
  productName: 24,
  modelNum: 25,
  listPrice: 28,
  width: 51,
  depth: 52,
  height: 53,
  weight: 54,
  totalMin: 55,
  totalMax: 56,
  cable: 57,
  inclination: 58,
  bulbType1: 60,
  mainBulbNum: 61,
  bulbBase: 63,
  ra: 64,
  attachBulb: 71,
  lumen: 72,
  ctLow: 73,
  ctHigh: 74,
  bulbType2: 75,
  bulbKind: 76,
  bulbColor: 77,
  dimming1: 78,
  dimmingType: 79,
  imgName: 83,
  comment: 93,
  detailAll: 94,
  imageM01: 100,
  imgFolder: 132,
  opCategory: 133,
  sinVar: 16,
} as const;

const cell = (r: Row, c: number): CellValue => r[String(c)];
const str = (r: Row, c: number): string => vbStr(cell(r, c));

function specRows(p: PlSpecSource): Row[] {
  const rows = ((p.extra ?? {}) as Record<string, unknown>).specRows;
  return Array.isArray(rows) ? (rows as Row[]) : [];
}
function isOtherSheet(p: PlSpecSource): boolean {
  return ((p.extra ?? {}) as Record<string, unknown>).sheet === "other";
}

// SetImgAlt: [イメージ名 ]メーカー名製ペンダントライト(その他シートは製+カテゴリ1) メーカー型番 fazoo型番(商品種別で語を置換)
function imgAlt(r: Row, other: boolean): string {
  let s = "";
  if (str(r, C.imgName) !== "") s += `${str(r, C.imgName)} `;
  s += str(r, C.makerJp);
  s += other ? `製${str(r, C.opCategory)} ` : "製ペンダントライト ";
  s += str(r, C.modelNum);
  s += " ";
  s += str(r, C.idFazoo);
  const t = str(r, C.itemType);
  const word: Record<string, string> = {
    CL: "シーリングライト",
    LR: "ライティングレール",
    AC: "オプション",
    OP: "オプション",
    CF: "シーリングファン",
  };
  if (t === "PL") return s;
  if (word[t]) return s.split("ペンダントライト").join(word[t]);
  throw new Error(`商品種別が不正です(${t})`);
}

// 1商品分のHTML。出力対象外(登録フラグ○の行が無い)は null。データ不備はエラー(現行マクロは Stop で止まる)
export function plSpecHtml(p: PlSpecSource): HtmlFile | null {
  const rows = specRows(p);
  // 現行は選択範囲を上から見て、最初の「登録フラグ○」行で商品グループを処理する(その行がアクティブセル)
  const active = rows.find((r) => str(r, C.importFlag) === "○");
  if (!active) return null;
  const parents = rows.filter((r) => ["単品", "親バリエーション"].includes(str(r, C.sinVar)));
  const mainVar =
    str(active, C.sinVar) === "単品" ? active : rows.filter((r) => str(r, C.sinVar) === "親バリエーション").pop();
  if (!mainVar || parents.length === 0) throw new Error("親バリエーションがありません");
  if (str(mainVar, C.importFlag) !== "○") throw new Error("親バリエーションの商品登録フラグがOFFです");
  const other = isOtherSheet(p);

  let title = "";
  const models: string[] = [];
  const prices: string[] = [];
  const texts: string[] = [];
  for (const r of rows) {
    if (!(str(r, C.importFlag) === "○" && str(r, C.eos) !== "○")) continue;
    const pn = str(r, C.productName);
    const mn = str(r, C.modelNum);
    let model: string;
    if (!vbEq(cell(r, C.productName), cell(r, C.modelNum))) {
      title += title === "" ? `${pn} ${mn} / ` : `${mn} / `;
      if (!other) model = `${pn} ${mn}`;
      else model = rows.length === 1 && pn.includes(mn) ? pn : `${pn} ${mn}`;
    } else {
      title += `${pn} / `;
      model = pn;
    }
    model += `  「${models.length + 1}. ${str(r, C.bulbType2)}${str(r, C.bulbKind)}`;
    if (str(r, C.bulbColor) !== "") model += `／${str(r, C.bulbColor)}`;
    model += "」";
    // その他別管理一覧FS は電球別のバリエーションが無いため「 「1. 」」を消す
    if (other) model = model.split(" 「1. 」").join("");

    const lp = cell(r, C.listPrice);
    if (vbStr(lp) === "O") prices.push("オープン価格");
    else if (vbPositive(lp)) prices.push(`${vbStr(lp)}円`);
    else throw new Error(`定価が記入されていない可能性があります(${pn})`);

    texts.push(brLines(`${model}\r\n\r\n${str(r, C.detailAll)}`));
    models.push(model);
  }
  if (title !== "") {
    title = title.slice(0, -2); // 末尾の「/ 」を削除(直前のスペースは残る)
    if (!other) title += `${str(mainVar, C.mainGroup)}製ペンダントライト`;
  } else {
    title = "生産終了品";
  }
  const comment = brLines(str(mainVar, C.comment));

  if (str(active, C.imageM01) === "") throw new Error("メイン画像が設定されていません");
  const imgPath = `  <p class="spec_mainimg"><img src="${FS_CMS_ITEM_IMGPATH}${str(active, C.imgFolder)}/${str(active, C.imageM01)}" alt="${imgAlt(active, other)}" width="400" height="400"></p>`;
  if (str(mainVar, C.imgFolder) === "") throw new Error("商品画像フォルダ名が未記入です");
  const m = (c: number) => str(mainVar, c);

  const L: string[] = ["", ""];
  const add = (...xs: string[]) => L.push(...xs);
  add(
    "<!DOCTYPE html>",
    '<html lang="ja"><head>',
    "  <!-- Google Tag Manager -->",
    "  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':",
    "  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],",
    "  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=",
    "  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);",
    "  })(window,document,'script','dataLayer','GTM-P5SDC6LM');</script>",
    "  <!-- End Google Tag Manager -->",
    '  <meta charset="UTF-8">',
    `  <title>${title} スペック情報 | ペンダントライト・ダイニング照明通販専門店 ファズー</title>`,
    '  <meta name="viewport" content="width=device-width">',
    '  <meta name="robots" content="noindex,nofollow">',
    `    <meta name="description" content="${title} スペック情報です。ペンダントライト・ダイニング照明選びならファズーにおまかせ。専門店として選びやすく豊富な品揃え！もちろん設置方法や取り付け工事まで丁寧にサポートします。">`,
    '    <meta name="keywords" content="ペンダントライト,ダイニング照明,ファズー" > ',
    "<!-- ++++++++++++++++++++++++ pl_HEAD ++++++++++++++++++++++++ -->",
    "<!-- common -->",
    `<link href="/common/css/reset.css" rel="preload" as="style" onload="this.rel='stylesheet'" type="text/css">`,
    `<link href="https://fonts.googleapis.com/css?family=Noto+Sans+JP:400,700&display=swap&subset=japanese" rel="preload" as="style" onload="this.rel='stylesheet'" type="text/css">`,
    `<link href="/common/css/common.css" rel="preload" as="style" onload="this.rel='stylesheet'" type="text/css">`,
    `<link href="/common/css/font.css" rel="preload" as="style" onload="this.rel='stylesheet'" type="text/css">`,
    '<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-cookie/1.4.1/jquery.cookie.min.js"></script>',
    '<script src="/common/js/loader.js" type="text/javascript"></script>',
    `<link href="/common/css/style_parts.css" rel="preload" as="style" onload="this.rel='stylesheet'" type="text/css">`,
    `<link href="/common/css/style_sys.css" rel="preload" as="style" onload="this.rel='stylesheet'" type="text/css">`,
    "<!-- spec -->",
    `<link href="/common/css/spec.css" rel="preload" as="style" onload="this.rel='stylesheet'" type="text/css">`,
    "<!-- ++++++++++++++++++++++++ //pl_HEAD ++++++++++++++++++++++++ -->",
    "</head>",
    "<body>",
    "<!-- Google Tag Manager (noscript) -->",
    '<noscript><iframe src="https://www.googletagmanager.com/ns.html?GTM-P5SDC6LM"',
    'height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>',
    "<!-- End Google Tag Manager (noscript) -->",
    '<div class="fs-l-page">',
    '<div id="container" class="drawer drawer--right">',
    "<!-- ++++++++++++++++++++++++ pl_ヘッダー（シンプル） ++++++++++++++++++++++++ -->",
    '<header id="header" class="simple">',
    '<div id="load_header_simple"></div><!--//load_header_simple-->',
    "</header><!--//header-->",
    "<!-- ++++++++++++++++++++++++ //pl_ヘッダー（シンプル） ++++++++++++++++++++++++ -->",
    '<div id="content" class="clearfix">',
    '<main class="fs-l-main">',
    "<!-- ++++++++++++++++++++++++ mainarea ++++++++++++++++++++++++ -->",
    '<div id="mainarea" class="clearfix">',
    '<div class="inner01 clearfix">',
    '<section id="pl_spac">',
    `  <h2 class="ttl_obi01"> ${title}</h2>`,
    imgPath,
    `  <p class="btn01 t-center mb030"><a href="/c/${m(C.imgFolder)}/${m(C.idFazoo)}">この商品の詳細ページを見る</a></p>`,
    '  <div class="block01">',
    '    <p class="f_size110 t-bolder mb015">商品スペック情報</p>',
    '    <table class="table_style mb010">',
    "    <tbody>",
    "    <tr>",
    "      <th>商品概要</th>",
    other
      ? `      <td class="td01" colspan="2">${str(active, C.opCategory)}</td>`
      : '      <td class="td01" colspan="2">ペンダントライト</td>',
    "    </tr>",
    "    <tr>",
    "      <th>メーカー</th>",
    `      <td class="td01" colspan="2">${m(C.makerJp)}</td>`,
    "    </tr>",
    "    <tr>",
    "      <th>商品名</th>",
    `      <td class="td01" colspan="2">${m(C.productName)}</td>`,
    "    </tr>",
    "    <tr>",
    "      <th>商品型番</th>",
    `      <td class="td01" colspan="2">${m(C.modelNum)}</td>`,
    "    </tr>",
    "    <tr>",
    `      <th rowspan="${models.length + 1}">定価(税別)</th>`,
    '      <td class="td02">商品型番</td>',
    '      <td class="td03">金額</td>',
    "    </tr>"
  );
  models.forEach((model, i) => {
    add("    <tr>", `      <td class="td02">${model}</td>`, `      <td class="td03">${prices[i]}</td>`, "    </tr>");
  });
  const row2 = (label: string, value: string) =>
    add("    <tr>", `      <td class="td02">${label}</td>`, `      <td class="td03">${value}</td>`, "    </tr>");
  add(
    "    <tr>",
    '      <th rowspan="8">サイズ</th>',
    '      <td class="td02">横幅　mm</td>',
    `      <td class="td03">${m(C.width)}</td>`,
    "    </tr>"
  );
  row2("奥行　mm", m(C.depth));
  row2("照明の高さ　mm", m(C.height));
  row2("全高　mm", `${m(C.totalMin)} - ${m(C.totalMax)}`);
  row2("重量　kg", vbFormat01(cell(mainVar, C.weight)));
  row2("コード収納の有無　mm", m(C.cable));
  row2("傾斜対応　最大角度", m(C.inclination));
  row2("　", "　");
  add(
    "    <tr>",
    '      <th rowspan="14">電球／LED　詳細</th>',
    '      <td class="td02">電球（同梱電球・一体型・同梱電球無し）</td>',
    `      <td class="td03">${m(C.bulbType1)}</td>`,
    "    </tr>"
  );
  row2("メイン　電球数", m(C.mainBulbNum));
  row2("口金", m(C.bulbBase));
  row2("Ra値", m(C.ra));
  row2("初期電球種類", m(C.attachBulb));
  row2("明るさ lm", m(C.lumen));
  row2("色温度１　ケルビン", m(C.ctLow));
  row2("色温度２　ケルビン", m(C.ctHigh));
  row2("電球種類", m(C.bulbType2));
  row2("調光種別", m(C.bulbKind));
  row2("電球発光色", m(C.bulbColor));
  row2("調光方式", m(C.dimming1));
  row2("調光　段階切り替え", m(C.dimmingType));
  row2("", m(C.backorder));
  add("    <tr>", "      <th>商品コメント</th>", `      <td class="td01" colspan="2">${comment}</td>`, "    </tr>");
  for (const t of texts) {
    add("    <tr>", "      <th>商品詳細</th>", `      <td class="td01" colspan="2">${t}</td>`, "    </tr>");
  }
  add(
    "    <tr>",
    "      <th></th>",
    '      <td class="td01" colspan="2">&nbsp;</td>',
    "    </tr>",
    "    <tr>",
    "      <th></th>",
    '      <td class="td01" colspan="2">&nbsp;</td>',
    "    </tr>",
    "    </tbody>",
    "    </table>",
    '    <p class="f_red">※作成中データになりますので一部間違いがある場合がございます</p>',
    "  </div>",
    '  <div class="btn_close">',
    `    <input type="button" onclick="(window.open('','_top').opener=top).close();" value="閉じる">`,
    "  </div>",
    "</section>",
    "</div><!--//inner01-->",
    "</div><!--//mainarea-->",
    "<!-- ++++++++++++++++++++++++ //mainarea ++++++++++++++++++++++++ -->",
    "</main>",
    "</div><!--//content-->",
    "<!-- ++++++++++++++++++++++++ pl_フッター ++++++++++++++++++++++++ -->",
    '<div id="load_footer"></div><!--//load_footer-->',
    '<div id="load_footer_pagetop"></div><!--//load_footer_pagetop-->',
    '<div id="load_footer_copy"></div><!--//load_footer_copy-->',
    "<!-- ++++++++++++++++++++++++ //pl_フッター ++++++++++++++++++++++++ -->",
    "</div><!--//container-->",
    "</div><!--//fs-l-page-->",
    "</body></html>"
  );
  return { name: `${str(active, C.idFazoo)}.html`, body: writeLines(L, TEXT_ROW) };
}
