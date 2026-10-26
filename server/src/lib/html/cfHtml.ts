// シーリングファンの製品画像HTML(original/)・SPEC HTML(spec/)
// 現行マクロ ceilingfan/modules/original_JPG.bas の Set_originalJPG_TEXT と spec.bas の Set_SpecTEXT。
// タイトル・Description・キーワードは futureshop 商品CSVと同じ共通関数(商品ページタイトル 等)を使う。
// セル値は取込時に保持した生セル(products.extra.specCells。キーは実シートの列番号)を VBA と同じ規則で連結する
import type { Prisma } from "@prisma/client";
import { cfPageTitle, cfImgFolder } from "../fsCfComments.js";
import { cfDescription, cfPageKeywords } from "../fsCfGoods.js";
import { vbEq, vbFormatYen, vbPositive, vbStr, writeLines, type CellValue } from "./vb.js";
import type { HtmlFile } from "./plSpecHtml.js";

type ProductFull = Prisma.ProductGetPayload<{
  include: {
    maker: true;
    lightingAttrs: true;
    fanAttrs: true;
    variations: true;
    images: true;
    channelPrices: true;
    setComponents: true;
  };
}>;

const FS_CMS_ITEM_IMGPATH = "https://www.fazoo.biz/cf_item_img/";
const ORIGINAL_TEXT_ROW = 150;
const SPEC_TEXT_ROW = 250;

function cells(p: ProductFull): Record<string, CellValue> {
  return (((p.extra ?? {}) as Record<string, unknown>).specCells ?? {}) as Record<string, CellValue>;
}

// 出力対象: 商品登録フラグが ○ △ ■ ● の行
export function cfHtmlTarget(p: ProductFull): boolean {
  return ["○", "△", "■", "●"].includes(vbStr(cells(p)["1"]));
}

// 共通の head(製品画像・SPEC とも同じ。robots の行末だけ違う)
function head(title: string, meta: string, keywords: string, robotsTail: string): string[] {
  return [
    '<html lang="ja"><head>',
    '  <meta charset="UTF-8">',
    `  <meta name="robots" content="noindex"/>${robotsTail}`,
    title,
    '  <meta name="viewport" content="width=device-width">',
    "",
    "",
    `  <meta name="description" content="${meta}">`,
    `  <meta name="keywords" content="${keywords}">`,
    "  ",
    '  <link rel="stylesheet" href="https://fazoo.itembox.cloud/system/fs_style.css">',
    '  <link rel="stylesheet" href="https://fazoo.itembox.cloud/generate/theme9/fs_original.css">',
    "  ",
    "    ",
    "<!-- ++++++++++++++++++++++++ cf_HEAD ++++++++++++++++++++++++ -->",
    '<script type="text/javascript" async="" src="https://www.googleadservices.com/pagead/conversion_async.js"></script>',
    '<script type="text/javascript" async="" src="//www.googleadservices.com/pagead/conversion_async.js"></script>',
    '<script type="text/javascript" async="" src="https://www.google-analytics.com/plugins/ua/ec.js"></script>',
    '<script type="text/javascript" async="" src="https://www.google-analytics.com/plugins/ua/linkid.js"></script>',
    "",
    '<script async="" src="//www.google-analytics.com/analytics.js"></script>',
    "",
    '<script type="text/javascript">',
    "    var cartUrlDomain = 'https://www.fazoo.biz/CART';",
    "</script>",
    "",
    "<!--[if lt IE 9]>",
    '<script type="text/javascript">',
    'var html5_elements = ["article","aside","dialog","figure","footer","header","hgroup","menu","nav","section"];',
    "for (var i=0, len=html5_elements.length; i < len; i++){",
    "        try{document.createElement(html5_elements[i])}catch(e){}",
    "}",
    "</script>",
    "",
    "<![endif]-->",
    "",
    "",
    "",
    "<!-- common -->",
    `<link href="https://www.fazoo.biz/common/css/import.css" rel="preload" as="style" onload="this.rel='stylesheet'" type="text/css">`,
    '<link href="https://www.fazoo.biz/common/css/common.css" rel="stylesheet" type="text/css">',
    '<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-cookie/1.4.1/jquery.cookie.min.js"></script>',
    '<script src="https://www.fazoo.biz/common/js/loader.js" type="text/javascript"></script>',
    "",
    "<!-- recomend -->",
    '<script src="https://www.fazoo.biz/common/js/exp_tag.js" type="text/javascript" async></script>',
    "",
    `<link href="https://www.fazoo.biz/common/css/style_parts.css" rel="preload" as="style" onload="this.rel='stylesheet'" type="text/css">`,
    `<link href="https://www.fazoo.biz/common/css/style_sys.css" rel="preload" as="style" onload="this.rel='stylesheet'" type="text/css">`,
    "",
    "<!-- example spec etc -->",
    '<link href="https://www.fazoo.biz/common/css/example.css" rel="stylesheet" type="text/css">',
    "",
    "<!-- ++++++++++++++++++++++++ //cf_HEAD ++++++++++++++++++++++++ -->",
    "",
    '<script async src="https://www.googletagmanager.com/gtag/js?id=UA-28944847-1"></script>',
    "<!-- Google Tag Manager -->",
    "<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':",
    "new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],",
    "j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=",
    "'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);",
    "})(window,document,'script','dataLayer','GTM-5TSNC97');</script>",
    "<!-- End Google Tag Manager -->",
    "</head>",
    "",
    "<body>",
    "<!-- Google Tag Manager (noscript) -->",
    '<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5TSNC97"',
    'height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>',
    "<!-- End Google Tag Manager (noscript) -->",
    '<div class="fs-l-page">',
    '<div id="container" class="drawer drawer--right">',
    "",
    "<!-- ++++++++++++++++++++++++ ヘッダー（シンプル） ++++++++++++++++++++++++ -->",
    '<div id="load_header_simple"></div><!--//load_header_simple-->',
    "<!-- ++++++++++++++++++++++++ //ヘッダー（シンプル） ++++++++++++++++++++++++ -->",
    "",
    '<div id="content" class="clearfix">',
    "",
  ];
}

const FOOT = [
  "</div><!--//inner01-->",
  "</div><!--//mainarea-->",
  "",
  "<!-- ++++++++++++++++++++++++ //mainarea ++++++++++++++++++++++++ -->",
  "</div><!--//content-->",
  "",
  "<!-- ++++++++++++++++++++++++ フッター（シンプル） ++++++++++++++++++++++++ -->",
  '<div id="load_footer_simple"></div><!--//load_footer_simple-->',
  '<div id="load_footer_copy"></div><!--//load_footer_copy-->',
  '<div id="load_footer_pagetop"></div><!--//load_footer_pagetop-->',
  "<!-- ++++++++++++++++++++++++ //フッター（シンプル） ++++++++++++++++++++++++ -->",
  "",
  "</div><!--//container-->",
  "",
  "</div>",
  "</body></html>",
];

const CLOSE_BUTTON = [
  '  <div class="btn_close">',
  `    <input type="button" onclick="(window.open('','_top').opener=top).close();" value="閉じる">`,
  "  </div>",
];

// 製品画像HTML(Set_originalJPG_TEXT)。画像はオリジナル画像列、空ならメイン画像M1
export function cfOriginalHtml(p: ProductFull): HtmlFile {
  const c = cells(p);
  const title = cfPageTitle(p);
  let img = vbStr(c["143"]);
  if (img === "") img = vbStr(c["113"]);
  const imageUrl = `${FS_CMS_ITEM_IMGPATH}${cfImgFolder(img)}/${img}`;
  const lines = [
    "",
    "<!DOCTYPE html>",
    ...head(
      `  <title>製品画像 ${title}｜<公式>シーリングファン・ライト通販専門店 | ファズー【品揃え日本一】</title>`,
      cfDescription(p),
      cfPageKeywords(p),
      ""
    ),
    "<!-- ++++++++++++++++++++++++ mainarea ++++++++++++++++++++++++ -->",
    "",
    '<div id="mainarea" class="clearfix">',
    '<div class="inner01 clearfix">',
    "",
    `<h2 class="ttl_dotline">${title}</h2>`,
    "",
    "<!-- ++++++++++++++++++++++++ 製品画像 ++++++++++++++++++++++++ -->",
    '<section id="cf_original">',
    "",
    "",
    '  <div class="image_area block01">',
    `    <p><img src="${imageUrl}" alt="${title}" id="mainImg"></p>`,
    "  </div>",
    "",
    ...CLOSE_BUTTON,
    "",
    "",
    "</section><!--//cf_original-->",
    "<!-- ++++++++++++++++++++++++ //製品画像 ++++++++++++++++++++++++ -->",
    "",
    ...FOOT,
  ];
  return { name: `${p.productCode}.html`, body: writeLines(lines, ORIGINAL_TEXT_ROW) };
}

// SPEC HTML(Set_SpecTEXT)
export function cfSpecHtml(p: ProductFull): HtmlFile {
  const c = cells(p);
  const v = (col: number) => vbStr(c[String(col)]);
  const title = cfPageTitle(p);
  const tr = (label: string, col: number) => `    <tr><td class="td02">${label}</td><td class="td03">${v(col)}</td></tr>`;

  let price: string;
  if (v(41) === "O") price = '    <td class="td01" colspan="2">オープン価格</td>';
  else if (vbPositive(c["41"])) price = `    <td class="td01" colspan="2">${vbFormatYen(c["40"])}</td>`;
  else throw new Error("定価が記入されていない可能性があります");

  const height =
    v(35) !== "" && !vbEq(c["34"], c["35"])
      ? `    <tr><td class="td02">高さ　mm</td><td class="td03">${v(34)}-${v(35)}</td></tr>`
      : `    <tr><td class="td02">高さ　mm</td><td class="td03">${v(34)}</td></tr>`;

  const lines = [
    "<!DOCTYPE html>",
    ...head(
      `  <title>スペック情報 ${title}｜<公式>シーリングファン・ライト通販専門店 | ファズー【品揃え日本一】</title>`,
      cfDescription(p),
      cfPageKeywords(p),
      "  "
    ),
    "<!-- ++++++++++++++++++++++++ mainarea ++++++++++++++++++++++++ -->",
    "",
    '<div id="mainarea" class="clearfix">',
    '<div class="inner01 clearfix">',
    "",
    `<h2 class="ttl_dotline">${title}</h2>`,
    "",
    "<!-- ++++++++++++++++++++++++ 商品スペック情報 ++++++++++++++++++++++++ -->",
    '<section id="cf_spec">',
    "",
    '<h3 class="ttl_obi01"><span>商品スペック情報</span></h3>',
    "",
    '  <div class="block01">',
    '  <table class="table_style mb010">',
    "    <tr>",
    "    <th>商品概要</th>",
    `    <td class="td01" colspan="2">${v(19)}</td>`,
    "    </tr>",
    "    <tr>",
    "    <th>メーカー名</th>",
    `    <td class="td01" colspan="2">${v(17)}</td>`,
    "    </tr>",
    "    <tr>",
    "    <th>商品名</th>",
    `    <td class="td01" colspan="2">${v(20)}</td>`,
    "    </tr>",
    "",
    "    <tr>",
    '    <th rowspan="12">商品型番</th>',
    `    <td class="td02">組み合わせ型番</td><td class="td03">${v(21)}</td></tr>`,
    tr("シーリングファンライト（一体型）", 22),
    tr("シーリングファン本体", 23),
    tr("オプション ライト（照明）", 24),
    tr("オプション 延長パイプ", 25),
    tr("オプション フランジ（フレンジ）", 26),
    tr("オプション リモコン", 27),
    tr("オプション ファン用羽根", 28),
    tr("オプション", 29),
    tr("バリエーション型番１", 30),
    tr("バリエーション型番２", 31),
    tr("バリエーション型番３", 32),
    "",
    "    <tr>",
    "    <th>定価（税別）</th>",
    price,
    "    </tr>",
    "",
    "    <tr>",
    '    <th rowspan="4">サイズ</th>',
    `    <td class="td02">横幅　mm</td><td class="td03">${v(33)}</td></tr>`,
    height,
    tr("羽根までの高さ　mm", 36),
    tr("重量　kg", 37),
    "",
    "    <tr>",
    '    <th rowspan="20">機能詳細</th>',
    `    <td class="td02">ACモーター、DCモーター</td><td class="td03">${v(56)}</td></tr>`,
    tr("シーリングファン 羽根の枚数", 57),
    tr("風速(m/sec)", 58),
    tr("風量(m<sup>3</sup>/min)", 59),
    tr("回転数(r/min)", 60),
    tr("風量レベル", 61),
    tr("１／ｆゆらぎ、リズム回転", 71),
    tr("リモコン", 73),
    tr("カラー、ジャンル種別", 67),
    tr("本体ボディカラー", 68),
    tr("羽根のカラー①", 69),
    tr("羽根のカラー②", 70),
    tr("照明の数", 64),
    tr("照明の種類", 65),
    tr("調光機能", 72),
    tr("照度（ルーメン）", 77),
    tr("照度（畳数）ｎ畳から", 78),
    tr("照度（畳数）ｎ畳まで", 79),
    tr("延長パイプの長さ", 62),
    tr("傾斜天井、最大対応確", 80),
    "",
    "    <tr>",
    "    <th>商品詳細</th>",
    '    <td class="td01" colspan="2">',
    '    <p class="">',
    v(87),
    "    </p>",
    "    </td>",
    "    </tr>",
    "  </table>",
    "",
    '  <p class="f_red">※作成中データになりますので一部間違いがある場合がございます</p>',
    "  </div><!--//blovk01-->",
    "",
    "",
    ...CLOSE_BUTTON,
    "",
    "</section><!-- //cf_spec -->",
    "<!-- ++++++++++++++++++++++++ //商品スペック情報 ++++++++++++++++++++++++ -->",
    "",
    ...FOOT,
    "",
  ];
  return { name: `${p.productCode}.html`, body: writeLines(lines, SPEC_TEXT_ROW) };
}
