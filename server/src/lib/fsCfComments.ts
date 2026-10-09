// futureshop 商品CSV(CF版)の独自コメント(4)(11)〜(16)・外部連携任意項目のHTML/文章生成
// 現行VBA(ceilingfan/modules/futureshop商品CSV.bas 独自コメント04/11〜16, Shopserve用.bas 内部用/外部用キャッチコピー・
// 商品ページタイトル・SetFindKeyword, futureshopPublic.bas SetFunctionIcon/ImgFileNameToFilePath)の出力を再現する。
// 改行: VBAは vbNewLine(CRLF)でHTMLを組み立てるため生成部分は "\r\n"。セル値(紹介文・フリーHTML等)は取込値のまま埋め込む。
// 画像の縦横px(CheckImageInfo)は image_files テーブルの値を setCfImageSizes() で受け取る(scripts/seed-image-files.ts で投入)。
import type { Prisma } from "@prisma/client";
import { cfMaker, cfModelConcat, CF_LIFTER_CODES } from "./fsCfGoods.js";

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
const LAZY_SRC = "data:image/gif;base64,R0lGODlhAQABAGAAACH5BAEKAP8ALAAAAAABAAEAAAgEAP8FBAA7";
const SHOPSERVE_IMGPATH = "//www.fazoo.biz/pic-labo/";
const FUTURESHOP_IMGPATH = "//fazoo.itembox.design/item/fazoo/";
// Common.bas の定数
const AIR_VOL_E1 = 70;
const AIR_VOL_E11 = 80;
const SLIM_TYPE_HEIGHT = 350;
const SMALL_TYPE_WIDTH = 900;
const MEDIUM_TYPE_WIDTH = 1100;
const LARGE_TYPE_WIDTH = 1200;
const LIGHT_WEIGHT_TYPE1 = 5;
const LIGHT_WEIGHT_TYPE2 = 7;

function cfExtra(p: ProductFull): Record<string, unknown> {
  return (p.extra ?? {}) as Record<string, unknown>;
}
function exs(p: ProductFull, key: string): string {
  const v = cfExtra(p)[key];
  return typeof v === "string" ? v : "";
}
function exNum(p: ProductFull, key: string): number | null {
  const v = cfExtra(p)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
// 数値/文字列を保持した生セル(VBAの VarType=vbDouble 判定用)
function exCell(p: ProductFull, key: string): number | string | null {
  const v = cfExtra(p)[key];
  return typeof v === "number" || typeof v === "string" ? v : null;
}
function component(p: ProductFull, role: string): string {
  return p.setComponents.find((c) => c.role === role)?.componentModel ?? "";
}
// VBAの「セル <= 数値」比較: 空セルは0扱い
function cellNum(v: number | null | undefined): number {
  return v == null ? 0 : Number(v);
}
// 生数値(widthRaw等)があれば優先(小数誤差込みで判定するため)
function widthNum(p: ProductFull): number {
  return exNum(p, "widthRaw") ?? cellNum(p.widthMm);
}
function heightNum(p: ProductFull): number {
  return exNum(p, "heightRaw") ?? cellNum(p.heightMm);
}
function weightNum(p: ProductFull): number {
  return exNum(p, "weightRaw") ?? cellNum(p.weightKg == null ? null : Number(p.weightKg));
}

// セルの数値をVBAの文字列化(有効15桁)で出す。生数値(extra)があれば優先
function vbNumStr(n: number): string {
  return String(Number(n.toPrecision(15)));
}
function rawNumStr(p: ProductFull, key: string, fallback: number | null | undefined): string {
  const v = exNum(p, key) ?? (fallback == null ? null : Number(fallback));
  return v == null ? "" : vbNumStr(v);
}

// ================= 画像サイズ(CheckImageInfo) =================
let imageSizes = new Map<string, { width: number; height: number }>();
// generateRows から対象商品の画像サイズを一括ロードして渡す
export function setCfImageSizes(map: Map<string, { width: number; height: number }>): void {
  imageSizes = map;
}
// 対象商品の画像ファイル名(サイズ一括ロード用)
export function cfImageFileNames(p: ProductFull): string[] {
  return cfImageCells(p).filter((v): v is string => !!v && /\.(jpg|gif)/.test(v));
}
// サイズ不明(image_files 未登録)の画像は width/height を空にする(VBAは画像実ファイルを読みに行き、無ければ停止)
function sizeAttr(fileName: string): string {
  const s = imageSizes.get(fileName);
  return s ? `width="${s.width}" height="${s.height}"` : `width="" height=""`;
}

// ================= 共通ヘルパー =================
// B_ライト有無: 型番_一体型 or 型番_ライト
export function cfHasLight(p: ProductFull): boolean {
  return !!p.modelNumber || !!component(p, "LIGHT");
}
// 商品登録優先度が△(オプション単体商品)か
export function cfIsSingleOption(p: ProductFull): boolean {
  return exs(p, "priority") === "△";
}
// 入荷予定の生値(即日発送/在庫切れ/即日切れ/入荷待ち/予約販売/生産終了/その他)
function cfArrival(p: ProductFull): string {
  return p.statusNote ?? "";
}
function cfMakerCode(p: ProductFull): string {
  return p.maker?.makerCode ?? "";
}
// 型番_一体型〜型番_オプション(8列)の入力数(CountA)
function modelCellCount(p: ProductFull): number {
  return [p.modelNumber, ...["FAN", "LIGHT", "PIPE", "FLANGE", "REMOTE", "BLADE", "OPTION"].map((r) => component(p, r))].filter(
    Boolean
  ).length;
}

// 画像データM1〜E1(INPUT_COL 112〜135)の生セル。旧取込データ(cfImageCells なし)は images から復元
const IMG_COL = {
  M1: 0, M2: 1, FHtml1: 2, FHtml2: 3, MV_FS: 4, MV_YA: 5, MV_RA: 6,
  I1: 7, I10: 16, S1: 17, S2: 18, F1: 19, F3: 21, R1: 22, E1: 23,
} as const;
function cfImageCells(p: ProductFull): (string | null)[] {
  const raw = cfExtra(p)["cfImageCells"];
  if (Array.isArray(raw)) return raw.map((v) => (typeof v === "string" ? v : null));
  const cells: (string | null)[] = Array(24).fill(null);
  const put = (type: string, start: number, count: number) => {
    for (const img of p.images) {
      if (img.imageType === type && img.sortNo >= 1 && img.sortNo <= count) cells[start + img.sortNo - 1] = img.fileName;
    }
  };
  put("MAIN", IMG_COL.M1, 2);
  put("IMAGE", IMG_COL.I1, 10);
  put("SIZE", IMG_COL.S1, 2);
  put("FUNCTION", IMG_COL.F1, 3);
  put("REMOTE", IMG_COL.R1, 1);
  put("ACCESSORY", IMG_COL.E1, 1);
  return cells;
}

// ImgFileNameToFilePath: ファイル名の先頭(最初の「_」「-」の手前)からメーカーフォルダ名
const IMG_FOLDER_MAP: Record<string, string> = {
  ivillage: "ivillage", IV: "ivillage", agled: "agled", daiko: "daiko", DA: "daiko",
  dulton: "dulton", hanwa: "LifeOnProducts", HA: "LifeOnProducts", LifeOnProducts: "LifeOnProducts",
  hermosa: "hermosa", HM: "hermosa", BIMAKES: "hermosa", koizumi: "koizumi", KO: "koizumi",
  mercros: "mercros", MR: "mercros", "minka-aire": "minka-aire", minka: "minka-aire", IMI: "minka-aire",
  mitsubishi: "mitsubishi", MB: "mitsubishi", nec: "nec", nihondenko: "nihondenko", ND: "nihondenko",
  odelic: "odelic", OD: "odelic", orrb: "orrb", OR: "orrb", panasonic: "panasonic", PN: "panasonic",
  takizumi: "takizumi", tokyometal: "tokyometal", TM: "tokyometal", toshiba: "toshiba",
  youwa: "youwa", YW: "youwa", Tradeone: "Tradeone", phiten: "phiten", PA: "phiten",
  mantra: "mantra", MA: "mantra",
};
export function cfImgFolder(fileName: string): string {
  // VBA: InStr(..)-1 が1未満(見つからない/先頭)なら100扱い
  const c1 = fileName.indexOf("_") < 1 ? 100 : fileName.indexOf("_");
  const c2 = fileName.indexOf("-") < 1 ? 100 : fileName.indexOf("-");
  const cut = Math.min(c1, c2);
  const prefix = cut >= 100 ? "" : fileName.slice(0, cut);
  return Object.prototype.hasOwnProperty.call(IMG_FOLDER_MAP, prefix) ? IMG_FOLDER_MAP[prefix] : "etc";
}

// Set小型軽量傾斜等: 特徴タグ("大風量 " のように後置スペース連結)
function isWindVolumeDouble(p: ProductFull): boolean {
  return typeof exCell(p, "windVolumeCell") === "number" || (exCell(p, "windVolumeCell") == null && p.fanAttrs?.windVolume != null && exs(p, "windVolumeRaw") !== "large1");
}
function windVolumeNum(p: ProductFull): number {
  const c = exCell(p, "windVolumeCell");
  return typeof c === "number" ? c : Number(p.fanAttrs?.windVolume ?? 0);
}
function isLarge1(p: ProductFull): boolean {
  const c = exCell(p, "windVolumeCell");
  return c === "large1" || (c == null && exs(p, "windVolumeRaw") === "large1");
}
export function cfSizeTags(p: ProductFull): string {
  const f = p.fanAttrs;
  let out = "";
  if (isWindVolumeDouble(p)) {
    if (windVolumeNum(p) >= AIR_VOL_E1) out += "大風量 ";
  } else if (isLarge1(p)) out += "大風量 ";
  if (f?.angledCeiling && f.angledCeiling !== "NG") out += "傾斜対応 ";
  if (cfHasLight(p)) {
    if (f?.lightKind === "LED") out += "LED ";
    const dim = f?.dimming ?? "";
    const color = f?.lightColor ?? "";
    if (dim === "調光" || dim === "無段階調光") out += `調光 ${color} `;
    else if (dim === "調光・光色切替" || dim === "調光・調色") out += `調光・${color} `;
    else out += `${color} `;
    if (f?.lightCount != null) out += `${f.lightCount}灯 `;
  }
  if (heightNum(p) <= SLIM_TYPE_HEIGHT && cfHasLight(p)) out += "薄型 ";
  if (widthNum(p) < SMALL_TYPE_WIDTH) out += "小型 ";
  if (weightNum(p) <= LIGHT_WEIGHT_TYPE2) out += "軽量 ";
  return out;
}

// 商品ページタイトル: 型番連結[,商品名] + 特徴タグ + メーカー英(日)製シーリングファン[ライト][【生産終了品】]
export function cfPageTitle(p: ProductFull): string {
  let out = cfModelConcat(p);
  const name = exs(p, "productNameRaw");
  if (name) out += `,${name}`;
  out += " ";
  const single = cfIsSingleOption(p);
  if (cfArrival(p) !== "生産終了" && !single) out += cfSizeTags(p);
  out += `${cfMaker(p, 2)}製`;
  if (!single) {
    out += "シーリングファン";
    if (cfHasLight(p)) out += "ライト";
  } else {
    out += "シーリングファン オプション単体";
  }
  if (CF_LIFTER_CODES.has(p.productCode)) out = out.split("オプション単体").join("電動昇降機・装置");
  if (cfArrival(p) === "生産終了") out += "【生産終了品】";
  return out;
}

const cfBanner = (dir: "↓↓" | "↑↑", n: number) =>
  `<!-- ---------------------------------------------\r\n ************${dir}独自コメント（${String(n).padStart(2, "0")}）${dir} ************\r\n--------------------------------------------- -->\r\n`;

// ================= Shipping_box: 納期・生産終了などのバナー =================
function cfShippingBox(p: ProductFull): string {
  const arrival = cfArrival(p);
  const arrivalText = exs(p, "arrivalText"); // 入荷待ち文言(7列)
  const identRaw = cfExtra(p)["identNo"];
  const ident = typeof identRaw === "number" ? identRaw : null;
  let out = "";
  const reserveComment = arrivalText
    ? `  <p class="reserve_comment">こちらの商品は、『<span>${arrivalText}</span>』でございます。</p>\r\n`
    : "";
  const reserveBanner = (cls: string, dt: string) =>
    `<div class="${cls} bnr_reserve_area free_block01">\r\n` +
    `  <div class="reserve_banner">\r\n` +
    `    <div class="reserve_banner_inner clearfix">\r\n` +
    `      <p class="reserve_img"><img class="lazyload" src="${LAZY_SRC}" data-src="https://www.fazoo.biz/common/img/icon_fan.png" alt="" width="74" height="74"></p>\r\n` +
    `      <dl>\r\n` +
    `        <dt>${dt}</dt>\r\n` +
    `        <dd>メーカーから入荷でき次第、商品を順次発送させていただきます。</dd>\r\n` +
    `      </dl>\r\n` +
    `    </div><!--//reserve_banner_inner-->\r\n` +
    `  </div><!--//reserve_banner-->\r\n` +
    reserveComment +
    `</div><!--//${cls.split(" ")[0]}-->\r\n`;
  if (arrival === "即日発送") {
    out +=
      `<div class="bnr_shipping free_block01">\r\n` +
      `  <dl class="clearfix">\r\n` +
      `    <dt class="bnr_shipping_box01">即日発送対応商品</dt>\r\n` +
      `    <dd class="bnr_shipping_box01"><span>こちらの商品は<em>15時まで</em>の</span><span>ご注文で<em>当日発送</em></span><br>月曜日から金曜日まで対応しています！</dd>\r\n` +
      `  </dl>\r\n` +
      `</div><!--//bnr_shipping-->\r\n`;
  } else if (arrival === "在庫切れ" || arrival === "即日切れ") {
    if (arrivalText && ident === 3) {
      out += reserveBanner("bnr_reserve01", "入荷待ち予約購入・受付中");
    }
    // 予約や入荷予定なし → バナーなし
  } else if (arrival === "入荷待ち") {
    out += reserveBanner("bnr_reserve01", "入荷待ち予約購入・受付中");
  } else if (arrival === "予約販売") {
    out += reserveBanner("bnr_reserve03", "<span>新商品</span>先行予約購入・受付中");
  } else if (arrival === "生産終了") {
    const endImg = `    <p class="end_img"><img class="lazyload" src="${LAZY_SRC}" data-src="https://www.fazoo.biz/common/img/icon_end.png" alt="生産終了" width="61" height="61"></p>\r\n`;
    if (p.successorModel) {
      const url = `${cfMaker(p, 11)}${p.successorModel}`;
      out +=
        `<div class="bnr_end01 free_block01">\r\n` +
        `  <div class="end_banner clearfix">\r\n` +
        endImg +
        `    <dl>\r\n` +
        `      <dt>こちらの商品は<span>メーカー生産終了品</span>となります。</dt>\r\n` +
        `      <dd><p class="mb005">本商品の<span>最新モデル</span>がございます。お求めの方は下記をクリックしてください。</p>\r\n` +
        `      <p class="link01"><a href="${url}">最新モデルはこちら</a></p></dd>\r\n` +
        `    </dl>\r\n` +
        `  </div><!--//end_banner-->\r\n` +
        `</div><!--//bnr_end01-->\r\n`;
    } else {
      out +=
        `<div class="bnr_end01 free_block01">\r\n` +
        `  <div class="end_banner clearfix">\r\n` +
        endImg +
        `    <dl>\r\n` +
        `      <dt>こちらの商品は<span>メーカー生産終了品</span>となります。</dt>\r\n` +
        `      <dd>後継機種（類似品）をご案内させていただきますので、お気軽にお問い合わせください。</dd>\r\n` +
        `    </dl>\r\n` +
        `  </div><!--//end_banner-->\r\n` +
        `</div><!--//bnr_end01-->\r\n`;
    }
  }
  return out;
}

// ================= 独自コメント(11): 配送状況・オプション単体バナー =================
export function cfComment11(p: ProductFull): string {
  let body = "";
  if (cfIsSingleOption(p)) {
    body +=
      `<div class="bnr_option01 free_block01">\r\n` +
      `  <div class="option_banner">\r\n` +
      `    <dl>\r\n` +
      `      <dt><span>こちらはオプションの</span><span>単体商品となります。</span></dt>\r\n` +
      `      <dd>単独で使用することができませんのでご注意ください。</dd>\r\n` +
      `    </dl>\r\n` +
      `  </div><!--//option_banner-->\r\n` +
      `</div><!--//bnr_option01-->\r\n`;
  }
  body += cfShippingBox(p);
  return `${cfBanner("↓↓", 11)}${body}${cfBanner("↑↑", 11)}\r\n`;
}

// ================= 独自コメント(12): メインイメージ+サイズ概要 =================
// スライダー対象: 画像データM1..E1(メイン2+イメージ10+サイズ2+機能3+リモコン+付属品)のうち .jpg/.gif のみ
// スライダー対象: 画像データM1〜E1 の列順(フリーHTML・動画HTML列を除く)で、".jpg"/".gif" を含むセル
function cfSliderImages(p: ProductFull): { fileName: string }[] {
  return cfImageCells(p)
    .map((v, i) => ({ v, i }))
    .filter(({ v, i }) => (i < IMG_COL.FHtml1 || i > IMG_COL.MV_RA) && !!v && (v.includes(".jpg") || v.includes(".gif")))
    .map(({ v }) => ({ fileName: v as string }));
}

export function cfComment12(p: ProductFull, _modelConcat?: string): string {
  const alt = cfPageTitle(p);
  let main = "";
  let thumbs = "";
  for (const img of cfSliderImages(p)) {
    const folder = cfImgFolder(img.fileName);
    main += `  <div class="main_slide"><img class="lazyload" src="${LAZY_SRC}" data-src="${FS_CMS_ITEM_IMGPATH}${folder}/${img.fileName}" alt="${alt}" width="768" height="500"></div>\r\n`;
    thumbs += `  <div class="thm_slide"><img class="lazyload" src="${LAZY_SRC}" data-src="${FS_CMS_ITEM_IMGPATH}${folder}/${img.fileName}" alt="${alt}" width="100" height="100"></div>\r\n`;
  }
  let body =
    `<div id="product_slide_box" class="mainslide">\r\n` +
    main +
    `</div><!--//product_slide_box-->\r\n\r\n` +
    `<div class="product_thumbnail">\r\n` +
    thumbs +
    `</div><!--//product_thumbnail-->\r\n\r\n`;

  // サイズなど情報
  body += `<div id="pgtop_detail_area" class="free_block01">\r\n`;
  const isLift = ["OXO001", "OXO002", "OXO003", "OXO004", "OXO007", "PXO001", "PXO002"].includes(p.productCode);
  if (!isLift) {
    const f = p.fanAttrs;
    body += `<ul class="product_size">\r\n`;
    body += `  <li>幅：${rawNumStr(p, "widthRaw", p.widthMm)}mm</li>\r\n`;
    if (p.height2Mm != null && p.heightMm !== p.height2Mm) {
      body += `  <li>高さ：${rawNumStr(p, "heightRaw", p.heightMm)}-${p.height2Mm}mm</li>\r\n`;
    } else {
      body += `  <li>高さ：${rawNumStr(p, "heightRaw", p.heightMm)}mm</li>\r\n`;
    }
    if (f?.heightToBladeMm != null) body += `  <li>羽根上：約${f.heightToBladeMm}mm</li>\r\n`;
    else body += `  <li>羽根上：データなし</li>\r\n`;
    body += `  <li>重さ：${rawNumStr(p, "weightRaw", p.weightKg == null ? null : Number(p.weightKg))}kg</li>\r\n`;
    const angled = f?.angledCeiling ?? "";
    if (angled && angled !== "NG") {
      body += angled.includes("-") ? `  <li>${angled}度</li>\r\n` : `  <li>0-${angled}度</li>\r\n`;
    } else {
      body += `  <li>傾斜不可</li>\r\n`;
    }
    const vol = f?.windVolume != null ? Number(f.windVolume) : null;
    if (vol != null && !Number.isNaN(vol)) body += `  <li>風量：${vol}m<sup>3</sup>/min</li>\r\n`;
    else body += `  <li>風量：データなし</li>\r\n`;
    const spd = f?.windSpeed != null ? Number(f.windSpeed) : null;
    if (spd != null && !Number.isNaN(spd)) {
      const fmt = Math.floor(spd * 10) === spd * 10 ? spd.toFixed(1) : spd.toFixed(2);
      body += `  <li>風速：${fmt}m/sec</li>\r\n`;
    } else {
      body += `  <li>風速：データなし</li>\r\n`;
    }
    if (f?.rotationSpeed != null) body += `  <li>回転数：${f.rotationSpeed}rpm</li>\r\n`;
    else body += `  <li>回転数：データなし</li>\r\n`;
    body += `</ul>\r\n`;
    // 組み合わせ商品(型番_一体型〜型番_オプションに2つ以上)
    const modelCells = [
      p.modelNumber,
      ...["FAN", "LIGHT", "PIPE", "FLANGE", "REMOTE", "BLADE", "OPTION"].map(
        (role) => p.setComponents.find((c) => c.role === role)?.componentModel
      ),
    ].filter(Boolean);
    if (modelCells.length > 1) {
      body +=
        `<div class="product_comment">\r\n` +
        `  <p>こちらのシーリングファンは上記の写真どおりのセット商品です。<br>\r\n` +
        `  取り付けの際に必要な部品は、すべて同梱されております。</p>\r\n` +
        `</div><!--//product_comment-->\r\n`;
    }
  }
  body += `</div><!--//pgtop_detail_area-->\r\n`;
  return `${cfBanner("↓↓", 12)}${body}${cfBanner("↑↑", 12)}\r\n`;
}

// ================= 独自コメント(15): %OFF表示 =================
export function cfComment15(p: ProductFull): string {
  const listRaw = exs(p, "listPriceRaw");
  const sail = p.sellingPrice ?? 0;
  const list = p.listPriceInTax ?? 0;
  let body = "";
  if (listRaw.toLowerCase() === "o") {
    // オープン価格 → 表示なし
  } else if (list <= sail || list <= 0 || sail <= 0) {
    // 値引きなし → 表示なし
  } else {
    const off = ((sail / list - 1) * -100).toFixed(1);
    body = `<div class="price-down">\r\n<span>${off}% OFF</span>\r\n</div>\r\n`;
  }
  return `${cfBanner("↓↓", 15)}${body}${cfBanner("↑↑", 15)}\r\n`;
}

// ================= 独自コメント(16): カート付近のバナー文言 =================
export function cfComment16(p: ProductFull): string {
  let body = "";
  if (exs(p, "moneyBack90") === "なし") {
    body +=
      `<div class="product_parts01">\r\n` +
      `   <div class="comment01">\r\n` +
      `       <p><span>こちらの商品は</span><span><em>90日間返金保証対象外</em></span><span>です</span></p>\r\n` +
      `   </div>\r\n` +
      `</div>\r\n`;
  }
  const sub2 = (p.descriptions as { label: string; body: string }[] | null)?.find(
    (d) => d.label === "サブ紹介文2"
  )?.body;
  if (sub2) {
    body += `<div class="product_parts01">\r\n  ${sub2}\r\n</div>\r\n`;
  }
  return `${cfBanner("↓↓", 16)}${body}${cfBanner("↑↑", 16)}\r\n`;
}

// ================= 独自コメント(14): カート下(在庫バナー・5つの安心・取付方法・動画・商品詳細) =================
export function cfComment14(p: ProductFull, _modelConcat?: string): string {
  const modelConcat = cfModelConcat(p);
  let body = "";
  const shipping = cfShippingBox(p);
  body += shipping;
  const isImport = cfMakerCode(p) === "IM";
  if (isImport) {
    body +=
      `<div class="overseas_block01 free_block01">\r\n` +
      `  <p>※海外製品は個人輸入での購入となります。<br>\r\n` +
      `海外製シーリングファンは90日間返金保証、3年保証の対象外となります。<br>\r\n` +
      `お届けには1週間程度お時間が掛かる場合がございますので、お急ぎの場合はお気軽にお問い合わせください。<br>\r\n` +
      `表示価格で購入頂けますが、為替レートや送料高騰などにより表示価格が変動する場合がございます。</p>\r\n` +
      `</div><!--//overseas_block01-->\r\n\r\n`;
  } else if (shipping === "") {
    body +=
      `<div class="bnr_zaiko01 free_block01">\r\n` +
      `  <div class="zaiko_banner">\r\n` +
      `    <dl>\r\n` +
      `      <dt>在庫がある場合、午前中までのご注文で翌営業日中に発送致します。</dt>\r\n` +
      `      <dd>※事前に在庫を確認する場合は、メールまたはお電話にてお問い合わせください。</dd>\r\n` +
      `    </dl>\r\n` +
      `  </div><!--//zaiko_banner-->\r\n` +
      `</div><!--//bnr_zaiko01-->\r\n\r\n`;
  }

  // ファズーの5つの安心
  const li = (cls: string, file: string, alt: string) =>
    `  <li${cls ? ` class="${cls}"` : ""}><img class="lazyload" src="${LAZY_SRC}" data-src="https://www.fazoo.biz/cf_img/products_detail/${file}" alt="${alt}" width="144" height="116"></li>\r\n`;
  // ダクトレール取付(推定): 90日返金・3年保証とも対象外の表示
  if (isImport || cfIsSingleOption(p) || installIndex(p) === 6) {
    body += `<div id="fazoo_reliefs_block01" class="free_block01 reliefs_block03">\r\n`;
    body += `<h3><span>ファズーの<em>５つ</em>の<em>安心</em></span></h3>\r\n<div id="fazoo_reliefs_inner">\r\n<ul class="clearfix">\r\n`;
    body += li("reliefs_no", "reliefs01_no.png", "購入後90日間返金保証");
    body += li("reliefs_no", "reliefs02_no.png", "無料3年保証");
  } else if (exs(p, "moneyBack90") === "なし") {
    body += `<div id="fazoo_reliefs_block01" class="free_block01 reliefs_block02">\r\n`;
    body += `<h3><span>ファズーの<em>５つ</em>の<em>安心</em></span></h3>\r\n<div id="fazoo_reliefs_inner">\r\n<ul class="clearfix">\r\n`;
    body += li("reliefs_no", "reliefs01_no.png", "購入後90日間返金保証");
    body += li("", "reliefs02.png", "無料3年保証");
  } else {
    body += `<div id="fazoo_reliefs_block01" class="free_block01">\r\n`;
    body += `<h3><span>ファズーの<em>５つ</em>の<em>安心</em></span></h3>\r\n<div id="fazoo_reliefs_inner">\r\n<ul class="clearfix">\r\n`;
    body += li("", "reliefs01.png", "購入後90日間返金保証");
    body += li("", "reliefs02.png", "無料3年保証");
  }
  body += li("", "reliefs03.png", "10000円以上送料無慮");
  body += li("", "reliefs04.png", "多彩な決済方法");
  body += li("", "reliefs05.png", "取付工事も安心の全国対応");
  body +=
    `</ul>\r\n` +
    `<p class="reliefs_txt"><span>商品や取り付けでわからないことは、</span><span>お電話でも丁寧にお答えします。</span></p>\r\n` +
    `<dl class="clearfix">\r\n` +
    `  <dt class="dial_box01">お客様ご相談ダイヤル</dt>\r\n` +
    `  <dd class="dial_box01"><span class="day01">月～金　9時～18時</span><span class="reliefs_call">\r\n` +
    `    <a href="tel:0466-47-9490" onclick="gtag('event', 'sp_tap', {'event_category': 'tel','event_label': 'contact'});">0466-47-9490</a></span></dd>\r\n` +
    `</dl>\r\n` +
    `</div><!--//fazoo_reliefs_inner-->\r\n` +
    `</div><!--//fazoo_reliefs_block01-->\r\n\r\n`;

  // 取付方法(サブ紹介文_個別が空 かつ 単品でない場合)
  const notes = (p.fanAttrs?.installNotes ?? {}) as Record<string, string | null>;
  const t1 = notes.rosette ?? "";
  const t2 = notes.partialElectric ?? "";
  const t3 = notes.rosette2 ?? "";
  const t4 = notes.boltFixing ?? "";
  const t5 = notes.other ?? "";
  const subIndividual = (p.descriptions as { label: string; body: string }[] | null)?.find(
    (d) => d.label === "サブ紹介文_個別"
  )?.body;
  const instImg = (file: string, alt: string, w = 340, h = 132) =>
    `  <dd><img class="lazyload" src="${LAZY_SRC}" data-src="https://www.fazoo.biz/cf_img/products_detail/${file}" alt="${alt}" width="${w}" height="${h}"></dd>\r\n`;
  const boltImg = (file: string, h: number) =>
    `  <dd class="inst_bolt"><img class="lazyload" src="${LAZY_SRC}" data-src="https://www.fazoo.biz/cf_img/products_detail/${file}" alt="ネジ" width="24" height="${h}"></dd>\r\n`;
  // VBAは「= ""」判定のため空白のみのセルも入力ありになる(生セル subIndividualCell を優先)
  const subIndividualSet = "subIndividualCell" in cfExtra(p) ? exs(p, "subIndividualCell") !== "" : !!subIndividual;
  if (!subIndividualSet && !cfIsSingleOption(p)) {
    if (t1 === "○") {
      body +=
        `<div id="installation_block04" class="installation_block free_block01">\r\n` +
        `<h3><span>ご購入の前に必ずご確認ください</span></h3>\r\n` +
        `<div class="installation_inner clearfix">\r\n` +
        `<p class="inst_txt"><span>こちらの商品は<em>簡易取付タイプ</em>となり、</span><span>電気工事が<em>不要</em>です。</span><br>\r\n` +
        `下記の配線器具に、ご自身で取り付けることが可能です。</p>\r\n\r\n` +
        `<dl class="inst_box01 color02">\r\n  <dt>木ネジで固定する必要なし</dt>\r\n` +
        instImg("installation_04-01.png", "引掛埋込ローゼット フル引掛ローゼット") +
        `</dl>\r\n<dl class="inst_box01 color02">\r\n  <dt>天井に木ネジ固定する必要あり</dt>\r\n` +
        instImg("installation_04-02.png", "角型引掛シーリング 丸形フル引掛シーリング") +
        `</dl>\r\n<ul class="inst_li01">\r\n` +
        `  <li>簡易取付タイプでも、組み立てや取り付けなど1人では難しい場合がございます。</li>\r\n` +
        `  <li>壁スイッチに調光機能があるものや、壁スイッチ自体がない場合はお取り付けができません。</li>\r\n` +
        `  <li>戸建てや木造の建物へのお取り付けは、必ず天井裏の木材（野縁）に木ネジ4本で、付属のアタッチメントをしっかりと固定してください。</li>\r\n` +
        `  <li>上記以外の配線器具については、取り付けができない可能性がございますのでお問い合わせください。</li>\r\n` +
        `</ul>\r\n</div><!--//installation_inner-->\r\n</div><!--//installation_block04-->\r\n\r\n`;
    } else if (t1 === "hanwa_installation_05") {
      body +=
        `<div id="installation_block05" class="installation_block free_block01">\r\n` +
        `<h3><span>ご購入の前に必ずご確認ください</span></h3>\r\n` +
        `<div class="installation_inner clearfix">\r\n` +
        `<p class="inst_txt"><span>こちらの商品は<em>簡易取付タイプ</em>となり、</span><span>電気工事が<em>不要</em>です。</span><br>\r\n` +
        `下記の配線器具に、ご自身で取り付けることが可能です。</p>\r\n\r\n` +
        `<dl class="inst_box01 color02">\r\n  <dt>ローゼット用ネジ4個で設置</dt>\r\n` +
        instImg("installation_05-01.png", "引掛露出ローゼット フル引掛ローゼット") +
        boltImg("installation_bolt01.png", 34) +
        `</dl>\r\n<dl class="inst_box01 color02">\r\n  <dt>ローゼット用ネジ2個で設置可</dt>\r\n` +
        instImg("installation_05-02.png", "引掛埋込ローゼット 引掛露出ローゼット") +
        boltImg("installation_bolt01.png", 34) +
        `</dl>\r\n<dl class="inst_box01 color02">\r\n  <dt>木ネジでは固定する必要なし</dt>\r\n` +
        instImg("installation_05-03.png", "引掛露出ローゼット フル引掛ローゼット") +
        boltImg("installation_bolt01.png", 34) +
        `</dl>\r\n<dl class="inst_box01 color02">\r\n  <dt>天井に木ネジ固定する必要あり</dt>\r\n` +
        instImg("installation_05-04.png", "角型引掛シーリング 丸形フル引掛シーリング") +
        boltImg("installation_bolt02.png", 66) +
        `</dl>\r\n<ul class="inst_li01">\r\n` +
        `  <li>簡易取付タイプでも、組み立て取り付けなど1人では難しい場合がございます。</li>\r\n` +
        `  <li>壁スイッチに調光機能があるものや、壁スイッチ自体がない場合はお取り付けができません。</li>\r\n` +
        `  <li>戸建てや木造の建物へのお取り付けは、必ず天井裏の木材（野縁）に木ネジ4本で、付属のアタッチメントをしっかりと固定してください。</li>\r\n` +
        `  <li>上記以外の配線器具については、取り付けができない可能性がございますので、お問い合わせください。</li>\r\n` +
        `</ul>\r\n</div><!--//installation_inner-->\r\n</div><!--//installation_block05-->\r\n\r\n`;
    } else if (t1 === "phiten_installation_01") {
      body +=
        `<div id="installation_block04" class="installation_block free_block01">\r\n` +
        `<h3><span>ご購入の前に必ずご確認ください</span></h3>\r\n` +
        `<div class="installation_inner clearfix">\r\n` +
        `<p class="inst_txt"><span>こちらの商品は<em>簡易取付タイプ</em>となり、</span><span>電気工事が<em>不要</em>です。</span><br>\r\n` +
        `下記の配線器具に、ご自身で取り付けることが可能です。</p>\r\n\r\n` +
        `<dl class="inst_box01 color02">\r\n  <dt>ローゼットも<span class="f_red t-bolder">天井に木ネジ固定</span>する必要あり</dt>\r\n` +
        instImg("installation_04-01.png", "引掛埋込ローゼット フル引掛ローゼット") +
        `</dl>\r\n<dl class="inst_box01 color02">\r\n  <dt>天井に木ネジ固定する必要あり</dt>\r\n` +
        instImg("installation_04-02.png", "角型引掛シーリング 丸形フル引掛シーリング") +
        `</dl>\r\n<ul class="inst_li01">\r\n` +
        `  <li>簡易取付タイプでも、組み立てや取り付けなど1人では難しい場合がございます。</li>\r\n` +
        `  <li>壁スイッチに調光機能があるものや、壁スイッチ自体がない場合はお取り付けができません。</li>\r\n` +
        `  <li>戸建てや木造の建物へのお取り付けは、必ず天井裏の木材（野縁）に木ネジ4本で、付属のアタッチメントをしっかりと固定してください。</li>\r\n` +
        `  <li>上記以外の配線器具については、取り付けができない可能性がございますのでお問い合わせください。</li>\r\n` +
        `</ul>\r\n</div><!--//installation_inner-->\r\n</div><!--//installation_block04-->\r\n\r\n`;
    } else if (t2 === "○") {
      body +=
        `<div id="installation_block02" class="installation_block free_block01">\r\n` +
        `<h3><span>ご購入の前に必ずご確認ください</span></h3>\r\n` +
        `<div class="installation_inner clearfix">\r\n` +
        `<p class="inst_txt">こちらの商品はローゼットの種類によっては<em>電気工事</em>が必要となります。<br>ご購入の際にはご注意ください！</p>\r\n\r\n` +
        `<dl class="inst_box01">\r\n  <dt>ローゼットを外すため電気工事が必要</dt>\r\n` +
        instImg("installation_02-01.png", "引掛埋込ローゼット フル引掛ローゼット") +
        `</dl>\r\n<dl class="inst_box01 color02">\r\n  <dt>電気工事不要 天井に木ネジ固定必要</dt>\r\n` +
        instImg("installation_02-02.png", "角型引掛シーリング 丸形フル引掛シーリング") +
        `</dl>\r\n<ul class="inst_li01">\r\n` +
        `  <li>簡易取付タイプでも、組み立てや取り付けなど1人では難しい場合がございます。</li>\r\n` +
        `  <li>壁スイッチに調光機能があるものや、壁スイッチ自体がない場合はお取り付けができません。</li>\r\n` +
        `  <li>戸建てや木造の建物へのお取り付けは、必ず天井裏の木材（野縁）に木ネジ4本で、付属のアタッチメントをしっかりと固定してください。</li>\r\n` +
        `</ul>\r\n</div><!--//installation_inner-->\r\n</div><!--//installation_block02-->\r\n\r\n`;
    } else if (t3 === "○") {
      body +=
        `<div id="installation_block03" class="installation_block free_block01">\r\n` +
        `<h3><span>ご購入の前に必ずご確認ください</span></h3>\r\n` +
        `<div class="installation_inner clearfix">\r\n` +
        `<p class="inst_txt"><span>こちらの商品は<em>簡易取付タイプ</em>となり、</span><span>電気工事が<em>不要</em>です。</span><br>\r\n` +
        `下記の配線器具に、ご自身で取り付けることが可能です。</p>\r\n\r\n` +
        `<dl class="inst_box01 color02">\r\n  <dt>木ネジで固定する必要なし</dt>\r\n` +
        instImg("installation_03-01.png", "引掛埋込ローゼット") +
        `</dl>\r\n<dl class="inst_box01 color02">\r\n  <dt>天井に木ネジ固定する必要あり</dt>\r\n` +
        instImg("installation_03-02.png", "角型引掛シーリング 丸形フル引掛シーリング") +
        `</dl>\r\n<dl class="inst_box02 clear_b">\r\n  <dt>ネジ位置によっては取り付けが出来ない場合あり<span class="f_size80"> ※詳細はお問い合わせください</span></dt>\r\n` +
        instImg("installation_03-03.png", "引掛露出ローゼット フル引掛ローゼット") +
        `</dl>\r\n\r\n<ul class="inst_li01">\r\n` +
        `  <li>簡易取付タイプでも、組み立てや取り付けなど1人では難しい場合がございます。</li>\r\n` +
        `  <li>壁スイッチに調光機能があるものや、壁スイッチ自体がない場合はお取り付けができません。</li>\r\n` +
        `  <li>戸建てや木造の建物へのお取り付けは、必ず天井裏の木材（野縁）に木ネジ4本で、付属のアタッチメントをしっかりと固定してください。</li>\r\n` +
        `  <li>上記以外の配線器具については、取り付けができない可能性がございますのでお問い合わせください。</li>\r\n` +
        `</ul>\r\n</div><!--//installation_inner-->\r\n</div><!--//installation_block03-->\r\n\r\n`;
    } else if (t4 === "panasonic_installation_01") {
      body +=
        `<div id="installation_block06" class="installation_block free_block01">\r\n` +
        `<h3><span>ご購入の前に必ずご確認ください</span></h3>\r\n` +
        `<div class="installation_inner">\r\n` +
        `<p class="inst_txt"><span>こちらの商品は取り付けに電気工事が</span><span><em>必要</em>となります。</span><br>\r\n` +
        `<span>また、下記ローゼットタイプの配線器具には</span><span>取り付けできません。</span><br>\r\n` +
        `<span>ご購入の際はご注意ください！</span></p>\r\n` +
        `\r\n` +
        `<dl class="inst_box03 color02">\r\n  <dt>ローゼットタイプ取り付け不可</dt>\r\n` +
        instImg("installation_06-01.png", "引掛埋込ローゼット フル引掛ローゼット") +
        `</dl>\r\n` +
        `\r\n` +
        `<div class="inst_comment">\r\n` +
        `  <p>当店ファズーが提携する全国の電気工事店をご紹介できますので、<br>ご依頼の際は下記までお気軽にお問い合わせください。</p>\r\n` +
        `  <div class="inst_inquiry">\r\n` +
        `    <p class="inst_shop"><span>シーリングファン・ライト専門店</span> <span>ファズー</span></p>\r\n` +
        `    <p class="inst_call"><span><a href="tel:0466-47-9490">0466-47-9490</a></span></p>\r\n` +
        `    <p class="f_size90">月～金 9時～18時（土日祝除く）</p>\r\n` +
        `  </div>\r\n</div>\r\n</div><!--//installation_inner-->\r\n</div><!--//installation_block06-->\r\n\r\n`;
    } else if (t4 === "○" || t5 === "○") {
      body +=
        `<div id="installation_block01" class="installation_block free_block01">\r\n` +
        `<h3><span>ご購入の前に必ずご確認ください</span></h3>\r\n` +
        `<div class="installation_inner">\r\n` +
        `<p class="inst_txt"><span>こちらの商品は取り付けに電気工事が</span><span><em>必要</em>となります。</span><br><span>ご購入の際はご注意ください！</span></p>\r\n` +
        `<div class="inst_comment">\r\n` +
        `  <p>当店ファズーが提携する全国の電気工事店をご紹介できますので、<br>ご依頼の際は下記までお気軽にお問い合わせください。</p>\r\n` +
        `  <div class="inst_inquiry">\r\n` +
        `    <p class="inst_shop"><span>シーリングファン・ライト専門店</span> <span>ファズー</span></p>\r\n` +
        `    <p class="inst_call"><span><a href="tel:0466-47-9490" onclick="gtag('event', 'sp_tap', {'event_category': 'tel','event_label': 'contact'});">0466-47-9490</a></span></p>\r\n` +
        `    <p class="f_size90">月～金 9時～18時（土日祝除く）</p>\r\n` +
        `  </div>\r\n</div>\r\n</div><!--//installation_inner-->\r\n</div><!--//installation_block01-->\r\n\r\n`;
    } else if (installIndex(p) === 6) {
      // ダクトレール取付(手元のVBAソースに無い分岐。正解CSVの出力を再現)
      body +=
        `<div id="installation_block06" class="installation_block free_block01">\r\n` +
        `<h3><span>ご購入の前に必ずご確認ください</span></h3>\r\n` +
        `<div class="installation_inner">\r\n` +
        `<p class="inst_txt"><span>こちらの商品はダクトレール取付タイプのため、ローゼットへの取り付けはできません。</span><br>\r\n` +
        `<span>ご購入の際はご注意ください！</span></p>\r\n` +
        `\r\n` +
        `<div class="inst_comment">\r\n` +
        `  <p>お取り付けでお困りの場合は、当店ファズーまで<br>お気軽にお問い合わせください。</p>\r\n` +
        `  <div class="inst_inquiry">\r\n` +
        `    <p class="inst_shop"><span>シーリングファン・ライト専門店</span> <span>ファズー</span></p>\r\n` +
        `    <p class="inst_call"><span><a href="tel:0466-47-9490">0466-47-9490</a></span></p>\r\n` +
        `    <p class="f_size90">月～金 9時～18時（土日祝除く）</p>\r\n` +
        `  </div>\r\n</div>\r\n</div><!--//installation_inner-->\r\n</div><!--//installation_block06-->\r\n\r\n`;
    }
  }

  // 取付動画
  const video = p.fanAttrs?.installVideoType ?? "";
  const movieBox = (dt: string, pTxt: string, yt: string) =>
    `<dl class="movie_box01">\r\n  <dt>${dt}</dt>\r\n  <dd>\r\n    <p>${pTxt}</p>\r\n    <div><iframe src="https://www.youtube-nocookie.com/embed/${yt}?rel=0&amp;showinfo=0" frameborder="0" allowfullscreen></iframe></div>\r\n  </dd>\r\n</dl>\r\n`;
  if (video === "スタンダード") {
    body +=
      `<div id="movie_block01" class="movie_block free_block01 clearfix">\r\n` +
      `<h3 class="ttl_line01">シーリングファンのベース金具 アタッチメント取り付け 説明動画（30秒）</h3>\r\n\r\n` +
      movieBox("マンションなど鉄筋コンクリート造の場合", "（ローゼットへの固定）", "QqcZPusMWjA") + "\r\n" +
      movieBox("戸建やアパートなど木造の場合", "（木ネジを使用しての固定）", "5mm9HLuJkn0") +
      `</div><!--//movie_block01-->\r\n\r\n`;
  } else if (video === "Panaローゼット2本ネジ") {
    body +=
      `<div id="movie_block02" class="movie_block free_block01 clearfix">\r\n` +
      `<h3 class="ttl_line01">シーリングファンのベース金具アタッチメント取り付け 説明動画（38秒、30秒）</h3>\r\n\r\n` +
      movieBox("マンションなど鉄筋コンクリート造の場合", "（ローゼットへの固定）", "UA646BNNo38") + "\r\n" +
      movieBox("戸建やアパートなど木造の場合", "（木ネジを使用しての固定）", "5mm9HLuJkn0") +
      `</div><!--//movie_block02-->\r\n\r\n`;
  } else if (video === "マンションのみ電気工事" || video === "電気工事") {
    body +=
      `<div id="movie_block03" class="movie_block free_block01 clearfix">\r\n` +
      `<h3 class="ttl_line01">シーリングファンのベース金具アタッチメント取り付け 説明動画（43秒）</h3>\r\n\r\n` +
      movieBox("電気工事タイプを木ネジを使用して設置", "（電気工事士の資格が必要です）", "C-_YYKYHAJk") +
      `</div><!--//movie_block03-->\r\n\r\n`;
  } else if (video === "koizumiローゼット2本ネジ") {
    body +=
      `<div id="movie_block04" class="movie_block free_block01 clearfix">\r\n` +
      `<h3 class="ttl_line01">シーリングファンのベース金具アタッチメント取り付け 説明動画（30秒）</h3>\r\n\r\n` +
      movieBox("マンションなど鉄筋コンクリート造の場合", "（ローゼットへの固定）", "VWuNEWO9srQ") + "\r\n" +
      movieBox("戸建やアパートなど木造の場合", "（木ネジを使用しての固定）", "5mm9HLuJkn0") +
      `</div><!--//movie_block04-->\r\n\r\n`;
  }

  // 商品詳細について(サブ紹介文1 + 隠しページリンク)
  const sub1 = exs(p, "subIntro1Raw") || (p.detail ?? "");
  const aLinkWord = `${cfMaker(p, 2)} ${modelConcat}`;
  const specLink = cfHasLight(p)
    ? `${aLinkWord} シーリングファンライトSPEC`
    : `${aLinkWord} シーリングファンSPEC`;
  body +=
    `<div id="item_detail_block01" class="free_block01">\r\n` +
    `<h3 class="ttl_line01">商品詳細について</h3>\r\n\r\n` +
    `${sub1}\r\n\r\n` +
    `<ul id="product_item_detail">\r\n` +
    `  <li><a href="https://www.fazoo.biz/original/${p.productCode}.html" target="_blank"><span style="font-size: 90%;">${modelConcat} IMAGE</span></a></li>\r\n` +
    `  <li><a href="https://www.fazoo.biz/spec/${p.productCode}.html" target="_blank"><span style="font-size: 90%;">${specLink}</span></a></li>\r\n` +
    `</ul>\r\n` +
    `</div><!--//item_detail_block01-->\r\n`;
  return `${cfBanner("↓↓", 14)}${body}${cfBanner("↑↑", 14)}\r\n`;
}

// ================= VBA数値処理の補助 =================
// VBAの整数代入(CInt/Integer)は銀行丸め
function vbRound(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}
const pad = (n: number, w: number) => String(n).padStart(w, "0");
// 変数(Variant)セル vs 数値の比較用: 空→0、数値文字列→数値、非数値文字列→NaN
function variantNum(v: number | string | null): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// x*10 を x(倍精度)の正確な10進値で計算し、偶数丸め
function roundExactTimes10(x: number): number {
  const str = x.toPrecision(40); // 倍精度の正確な10進展開(末尾0埋め)
  const [ip, fp = ""] = str.split(".");
  const shifted = `${ip}${fp.slice(0, 1)}`;
  const rest = fp.slice(1);
  let n = Number(shifted);
  const half = rest.replace(/0+$/, "");
  if (half > "5" || (half.startsWith("5") && half.length > 1)) n += 1;
  else if (half === "5" && n % 2 !== 0) n += 1;
  return n;
}

// ================= Set型番連結(lRow, 2) F付き型番 =================
function cfVariationModels(p: ProductFull): [string, string, string] {
  const v = cfExtra(p)["cfVariationModels"];
  const a = Array.isArray(v) ? v : [];
  return [0, 1, 2].map((i) => (typeof a[i] === "string" ? (a[i] as string) : "")) as [string, string, string];
}
function cfModelConcatF(p: ProductFull): string {
  let out = "";
  if (p.combinationModel) out = `F${p.combinationModel} / `;
  const [v1, v2, v3] = cfVariationModels(p);
  const cols = [
    p.modelNumber ?? "",
    ...["FAN", "LIGHT", "PIPE", "FLANGE", "REMOTE", "BLADE", "OPTION"].map((r) => component(p, r)),
    v1,
    v2,
    v3,
  ];
  let done = false;
  for (const m of cols) {
    if (!m) continue;
    if (m === v1 || m === v2 || m === v3) {
      if (!done) {
        if (v3) out += `F${v1} / F${v2} / F${v3} + `;
        else if (v2) out += `F${v1} / F${v2} + `;
        else out += `F${v1} + `;
        done = true;
      }
    } else {
      out += `F${m} + `;
    }
  }
  return out ? out.slice(0, -3) : "";
}

// ================= SetFindKeyword(lRow, 販売価格, 1) 隠し検索キーワード(スペースなし) =================
function cfDuctRail(p: ProductFull): string {
  const n = (p.fanAttrs?.installNotes ?? {}) as Record<string, string | null>;
  return exs(p, "ductRailRaw") || (n.ductRail ?? "");
}
function installIndex(p: ProductFull): number {
  const n = (p.fanAttrs?.installNotes ?? {}) as Record<string, string | null>;
  // 6: ダクトレール取り付け(実シートで追加された列。手元のVBAソースには無く、正解CSVから挙動を推定)
  const cells = [n.rosette, n.partialElectric, n.rosette2, n.boltFixing, n.other, cfDuctRail(p)];
  const i = cells.findIndex((v) => !!v);
  return i < 0 ? 0 : i + 1;
}
function variationOpts(p: ProductFull): [string, string, string] {
  const v = cfExtra(p)["variationOptsRaw"];
  if (Array.isArray(v)) return [0, 1, 2].map((i) => (typeof v[i] === "string" ? (v[i] as string) : "")) as [string, string, string];
  return [1, 2, 3].map((n) => p.variations.find((x) => x.variationNo === n)?.optionValue ?? "") as [string, string, string];
}
function cfFindKeyword(p: ProductFull): string {
  if (cfArrival(p) === "生産終了" || cfIsSingleOption(p)) return "";
  const f = p.fanAttrs;
  const light = cfHasLight(p);
  let s = "";
  if (heightNum(p) < SLIM_TYPE_HEIGHT && light) s += ";S1";
  const mount = f?.mountType ?? "";
  if (mount === "直付") s += ";S";
  else if (mount === "パイプ" || mount === "加工パイプ") {
    const pipe = variantNum(exCell(p, "pipeLengthCell") ?? f?.extensionPipe ?? null);
    if (pipe < 30) s += ";P2";
    else if (pipe < 60) s += ";P3";
    else if (pipe < 90) s += ";P6";
    else if (pipe < 150) s += ";P9";
    else if (pipe < 200) s += ";P015";
    else if (pipe < 250) s += ";P020";
    else if (pipe >= 250) s += ";P025";
  }
  const w = widthNum(p);
  if (w < SMALL_TYPE_WIDTH) s += ";T1";
  else if (w === SMALL_TYPE_WIDTH) s += ";T21";
  else if (w < MEDIUM_TYPE_WIDTH) s += ";T22";
  else if (w === MEDIUM_TYPE_WIDTH) s += ";T31";
  else if (w < LARGE_TYPE_WIDTH) s += ";T32";
  else s += ";T33";
  const wt = weightNum(p);
  if (wt <= LIGHT_WEIGHT_TYPE1 && !light) s += ";G1";
  else if (wt <= LIGHT_WEIGHT_TYPE2 && light) s += ";G2";
  if (light) {
    const kind = f?.lightKind ?? "";
    if (kind === "LED") s += ";L11";
    else if (kind === "電球型蛍光灯") s += ";L12";
    else if (kind === "白熱灯" || kind === "電球なし") s += ";L13";
    if ((f?.lightCount ?? 0) > 0) s += `;LL${f?.lightCount}`;
  } else {
    s += ";F1";
  }
  const tatami = exNum(p, "tatamiToRaw") ?? (f?.tatamiTo ?? null);
  if (tatami != null && light) {
    const m: Record<string, string> = { "3": ";B3", "4.5": ";B3", "5.9": ";B2", "6": ";B2", "8": ";B12", "10": ";B11", "12": ";B02", "14": ";B01" };
    s += m[String(tatami)] ?? "";
  }
  const lumen = exNum(p, "lumenRaw") ?? (f?.brightnessLm ?? null);
  if (lumen != null && light) {
    if (lumen >= 5600) s += ";B01";
    else if (lumen >= 4000) s += ";B02";
    else if (lumen >= 3200) s += ";B11";
    else if (lumen >= 2400) s += ";B12";
    else if (lumen >= 1600) s += ";B2";
    else s += ";B3";
  }
  const blades = f?.bladeCount ?? 0;
  s += blades >= 2 && blades <= 8 ? `;F${blades}` : ";F9";
  s += cfMaker(p, 5);
  const price = p.sellingPrice ?? 0;
  if (price >= 70000) s += ";Y9";
  else if (price >= 50000) s += ";Y8";
  else if (price >= 30000) s += ";Y5";
  else if (price >= 0) s += ";Y4";
  const motor = f?.motorType ?? "";
  if (motor === "DC") s += ";DC";
  else if (motor === "AC") s += ";AC";
  const volDouble = isWindVolumeDouble(p);
  const vol = windVolumeNum(p);
  if (volDouble) {
    if (vol >= AIR_VOL_E11) s += ";E11";
    else if (vol >= AIR_VOL_E1) s += ";E1";
  } else if (isLarge1(p)) s += ";E1";
  const lv: Record<number, string> = { 5: ";W333", 4: ";W33", 3: ";W3", 2: ";W2", 1: ";W1" };
  s += lv[f?.windLevels ?? -999] ?? ";W2";
  if (volDouble) {
    if (vol >= 110) s += ";WL110";
    else if (vol >= 90) s += ";WL90";
    else if (vol >= 70) s += ";WL70";
    else if (vol >= 50) s += ";WL50";
    else if (vol >= 10) s += ";WL10";
  }
  const ang = f?.angledCeiling ?? "";
  if (ang !== "" && ang !== "NG") {
    const deg = ang.includes("-") ? vbRound(Number(ang.slice(ang.indexOf("-") + 1, ang.indexOf("-") + 11))) : vbRound(Number(ang));
    if (deg >= 30) s += ";D111";
    else if (deg >= 15) s += ";D11";
    else if (deg > 0) s += ";D1";
  }
  const inst = installIndex(p);
  if (inst >= 1 && inst <= 3) s += ";IE";
  else if (inst === 4 || inst === 5) s += ";IH";
  else if (inst === 6) s += ";ID";
  const remote = exs(p, "remoteRaw");
  if (["あり", "1ch", "2ch", "3ch", "4ch"].includes(remote)) s += ";RC";
  const dim = f?.dimming ?? "";
  if (["無段階調光", "調光", "調光・光色切替", "調光・調色"].includes(dim)) s += ";DM";
  if (dim === "調光・光色切替" || dim === "調光・調色") s += ";LP;LN";
  const [o1, o2, o3] = variationOpts(p);
  if (o2.includes("昼白色") || o3.includes("昼白色")) s += ";LN";
  if (o2.includes("昼光色") || o3.includes("昼光色")) s += ";LD";
  if (o1.includes("電球色") || (light && !o1.includes("昼白色") && !o1.includes("昼光色"))) s += ";LL";
  if (exs(p, "rhythmRaw") === "あり") s += ";RM";
  const flags = (p.flags ?? {}) as Record<string, unknown>;
  if (flags.misc === "得") s += ";FL1";
  if (p.countryOfOrigin === "Japan") s += ";JP";
  const color = f?.colorCategory ?? "";
  if (color.includes("北欧")) s += ";CH";
  if (color.includes("ホワイト")) s += ";CW";
  if (color.includes("クラシック")) s += ";CC";
  if (color.includes("ブラック")) s += ";CB";
  if (color.includes("有色")) s += ";C1";
  if (color === "北欧") s += ";C1";
  if (color === "") s += ";C1";
  return s;
}

// ================= 独自コメント(4): 内部用キャッチコピー(検索用) =================
export function cfComment04(p: ProductFull): string {
  const f = p.fanAttrs;
  const light = cfHasLight(p);
  const japan = p.countryOfOrigin === "Japan";
  let s = `おしゃれな${cfMaker(p, 2)}`;
  s += light ? "製シーリングファンライト(" : "製シーリングファン(";
  s += cfModelConcatF(p);
  s += japan ? ")日本製 国内生産です。" : ")です。";
  s += light
    ? "シーリングファンライト・インテリアファンライトのことなら通販専門店のfazoo(ファズー)におまかせ。"
    : "シーリングファン・インテリアファンのことなら通販専門店のfazoo(ファズー)におまかせ。";
  const arrival = cfArrival(p);
  if (arrival !== "生産終了" && !cfIsSingleOption(p)) {
    if (light) {
      s += "明るさ ";
      const lumen = exNum(p, "lumenRaw") ?? (f?.brightnessLm ?? null);
      if (lumen != null) s += `${lumen}lm `;
      const t = exNum(p, "tatamiToRaw") ?? (f?.tatamiTo ?? 0);
      if (t >= 14) s += "14畳用 ";
      else if (t >= 12) s += "12畳用 ";
      else if (t >= 10) s += "10畳用 ";
      else if (t >= 8) s += "8畳用 ";
      else if (t >= 6) s += "6畳用 ";
      else if (t >= 1) s += "3畳～4.5畳用 ";
    }
    s += cfSizeTags(p);
    if (japan) s += "日本製 ";
    const motor = f?.motorType ?? "";
    if (motor === "DC") s += "DC ";
    else if (motor === "AC") s += "AC ";
    s += light ? "照明付 " : "ファンのみ ";
    if (isWindVolumeDouble(p)) {
      if (windVolumeNum(p) >= AIR_VOL_E1) s += "大風量 ";
    } else if (isLarge1(p)) s += "大風量 ";
    if (exs(p, "rhythmRaw") === "あり") s += "リズム ";
    const inst = installIndex(p);
    if (inst === 1 || inst === 3) s += "簡易取付 ";
    else if (inst === 2) s += "一部電気工事 ";
    else if (inst === 4 || inst === 5) s += "電気工事取付 ";
    else if (inst === 6) s += "ダクトレール取付 ";
    s += cfFindKeyword(p);
  } else if (cfIsSingleOption(p)) {
    s += "単体 ";
  }
  if (arrival === "即日発送") s += "即日発送 ";
  else if (arrival === "即日切れ" || arrival === "在庫切れ") s += "在庫切れ ";
  if (arrival === "予約販売") s += "予約販売商品 ";
  return s.split(SHOPSERVE_IMGPATH).join(FUTURESHOP_IMGPATH);
}

// ================= 外部連携任意項目: 外部用キャッチコピー =================
export function cfExternalCatchCopy(p: ProductFull): string {
  let s = cfMaker(p, 8);
  s += cfHasLight(p) ? "シーリングファンライト" : "シーリングファン";
  s += `(${cfModelConcat(p)})`;
  s +=
    "創業2011年日本一の品揃えのシーリングファン専門通販ショップ。" +
    "おしゃれでおすすめな商品が1,500種類以上。" +
    "マンションや賃貸でも設置できる薄型・小型・軽量のシーリングファンライトから、" +
    "吹き抜けや傾斜・勾配天井用のシーリングファンまで、" +
    "多数の取付実績から正確な設置方法や取り付け工事など丁寧にサポートします。";
  return s;
}

// ================= SetFunctionIcon: 機能アイコン(独自コメント13の商品特徴) =================
const ICON = "https://www.fazoo.biz/cf_img/products_detail/";
function cfFunctionIcons(p: ProductFull): string {
  const f = p.fanAttrs;
  const img = (file: string, alt: string) => `<img src="${ICON}${file}" alt="${alt}">\r\n`;
  let s = "";
  const wr = p.warranty ?? "";
  if (wr === "m06iv06" || wr === "m12iv12" || wr === "m12iv24") s += img("icon_iv36.png", "無料3年保証");
  if (wr.includes("m36")) s += img("icon_m36.png", "メーカー保証3年間");
  else if (wr.includes("m24")) s += img("icon_m24.png", "メーカー保証2年間");
  else if (wr.includes("m12")) s += img("icon_m12.png", "メーカー保証1年間");
  else if (wr.includes("m06")) s += img("icon_m06.png", "メーカー保証6ヶ月");
  if (p.countryOfOrigin === "Japan") s += img("icon_madeinjp_01.png", "日本製");
  if (modelCellCount(p) > 1) s += img("icon_combination.png", "組合せ商品");
  const motor = f?.motorType ?? "";
  if (motor === "DC") s += img("icon_dc.png", "DCモーター");
  else if (motor === "AC") s += img("icon_ac.png", "ACモーター");
  if (f?.lightKind === "LED") s += img("icon_led.png", "LED照明");
  if ((f?.lightCount ?? 0) > 0) s += img(`icon_light${f?.lightCount}.png`, `${f?.lightCount}灯照明`);
  const watt = exNum(p, "wattRaw") ?? (f?.wattEquivalent ? Number(f.wattEquivalent) : null);
  if (watt != null && Number.isFinite(watt)) {
    const w = vbRound(watt);
    s += img(`icon_light${w}w.png`, `${w}w相当`);
  }
  const lumen = exNum(p, "lumenRaw") ?? (f?.brightnessLm ?? null);
  if (lumen != null) {
    const l = vbRound(lumen);
    s += img(`icon_lm${pad(l, 4)}.png`, `${l}lm`);
  }
  const tatami = exNum(p, "tatamiToRaw") ?? (f?.tatamiTo ?? null);
  if (tatami != null) {
    const t: Record<string, [string, string]> = {
      "4.5": ["icon_light4teido.png", "明るさ4.5畳程度"],
      "6": ["icon_light6teido.png", "明るさ6畳程度"],
      "5.9": ["icon_jyou06.png", "明るさ6畳まで"],
      "8": ["icon_light8teido.png", "明るさ8畳程度"],
      "10": ["icon_light10teido.png", "明るさ10畳程度"],
      "12": ["icon_light12teido.png", "明るさ12畳程度"],
      "14": ["icon_light14teido.png", "明るさ14畳程度"],
    };
    const hit = t[String(tatami)];
    if (hit) s += img(hit[0], hit[1]);
  }
  const dim = f?.dimming ?? "";
  if (dim === "調光") s += img("icon_choukou_lm.png", "調光");
  else if (dim === "無段階調光") s += img("icon_tyoukou.png", "無段階調光");
  else if (dim === "調光・光色切替") s += img("icon_choukou_lm.png", "調光") + img("icon_kousyoku_lm.png", "光色切替");
  else if (dim === "調光・調色") s += img("icon_choukou_lm.png", "調光") + img("icon_kousyoku_lm.png", "調色");
  const axis = exs(p, "variationAxisRaw") || (p.variations[0]?.axisName ?? "");
  if (axis === "照明の色合") {
    const [, o2, o3] = variationOpts(p);
    if (o3.includes("昼光色")) s += img("icon_light_l-n-d.png", "電球色、昼白色、昼光色から選択して購入");
    else if (o3.includes("昼白色")) s += img("icon_light_l-w-n.png", "電球色、温白色、昼光色から選択して購入");
    else if (o2.includes("昼光色")) s += img("icon_light_l-d.png", "電球色、昼光色から選択して購入");
    else if (o2.includes("昼白色")) s += img("icon_light_l-n.png", "電球色、昼白色から選択して購入");
  }
  const remote = exs(p, "remoteRaw");
  if (remote === "あり" || remote === "1ch") s += img("icon_remocon.png", "リモコン付属");
  else if (remote === "2ch") s += img("icon_remocon_2ch.png", "リモコン付属チャンネル切替数2ch");
  else if (remote === "3ch") s += img("icon_remocon_3ch.png", "リモコン付属チャンネル切替数3ch");
  else if (remote === "4ch") s += img("icon_remocon_4ch.png", "リモコン付属チャンネル切替数4ch");
  else if (remote === "プルSW") s += img("icon_pull_switch.png", "プルスイッチタイプ");
  const spdCell = exCell(p, "windSpeedCell");
  const spd = typeof spdCell === "number" ? spdCell : spdCell == null && f?.windSpeed != null ? Number(f.windSpeed) : null;
  if (spd != null) {
    if (spd >= 3.3) s += img("icon_windspeed330.png", "風速3.3m");
    else if (spd >= 3) s += img("icon_windspeed300.png", "風速3.0m");
    else {
      // VBAは Integer代入で丸める。倍精度の誤差込みの真値で判定(1.05*10 → 11)
      const i = roundExactTimes10(spd);
      s += img(`icon_windspeed${pad(i, 2)}0.png`, `風速${(Math.round(spd * 10 + 1e-9) / 10).toFixed(1)}m`);
    }
  }
  if (isWindVolumeDouble(p)) {
    const vol = windVolumeNum(p);
    if (vol >= 300) s += img("icon_airflow300.png", "風量300 m3/min以上");
    else if (vol >= 5) {
      const a = Math.trunc(vbRound(vol) / 5) * 5;
      s += img(`icon_airflow${pad(a, 3)}.png`, `風量${a} m3/min以上`);
    }
  } else if (isLarge1(p)) s += img("icon_airflow_large1.png", "大風量");
  if (exs(p, "rhythmRaw") === "あり") s += img("icon_rhythm.png", "リズム機能付き");
  const b1 = f?.bladeColor1 ?? "";
  const b2 = f?.bladeColor2 ?? "";
  if (b1 && b2 && b1 !== b2) s += img("icon_hane.png", "羽根リバーシブル");
  const ang = f?.angledCeiling ?? "";
  if (ang !== "NG" && ang !== "") {
    const n = Number(ang);
    const fmt = Number.isFinite(n) ? pad(vbRound(n), 2) : ang;
    s += img(`icon_degrees${fmt}.png`, `傾斜${ang}度まで対応`);
  } else if (ang === "NG") s += img("icon_degrees00.png", "傾斜天井設置不可");
  if (weightNum(p) <= LIGHT_WEIGHT_TYPE2) s += img("icon_lightweight7.png", "軽量7kg未満");
  const inst = installIndex(p);
  if (inst === 1 || inst === 3) s += img("icon_easysetup.png", "簡易取付");
  else if (inst === 2) s += img("icon_constructionsetup2.png", "簡易取付、一部電気工事");
  else if (inst === 4 || inst === 5) s += img("icon_constructionsetup.png", "電気工事取付");
  else if (inst === 6) s += img("icon_setup_rail.png", "ダクトレール取付");
  if ((motor === "DC" || motor === "AC") && cfMakerCode(p) !== "IM") s += img("icon_pse-mark.png", "PSEマーク");
  s += "<br>\r\n";
  return s;
}

// ================= 独自コメント(13): メーカーロゴ・機能アイコン・バリエーション・画像・効果 =================
const lazyImg = (dataSrc: string, rest: string) => `<img class="lazyload" src="${LAZY_SRC}" data-src="${dataSrc}" ${rest}>`;

type LcTd = { cls: string; ttl: string; alt: string; txt: string };
const LC_DENKYU: LcTd = { cls: "cl_denkyu", ttl: "暖かい光<br>（電球色）", alt: "暖かい光（電球色）", txt: "夕日に近い温かみのある光で<br>くつろぎやリラックス空間を演出" };
const LC_CHUHAKU: LcTd = { cls: "cl_chuhaku", ttl: "自然な白い光<br>（昼白色）", alt: "自然な白い光（昼白色）", txt: "生き生きとした自然な光に近く<br>さわやかな雰囲気を演出" };
const LC_CHUKO: LcTd = { cls: "cl_chuko", ttl: "少し青白い光<br>（昼光色）", alt: "少し青白い光（昼光色）", txt: "文字が読みやすく清涼感があり<br>クールな雰囲気を演出" };
const LC_ONPAKU: LcTd = { cls: "cl_onpaku", ttl: "自然な優しい光<br>（温白色）", alt: "自然な優しい光（温白色）", txt: "自然でニュートラルな光で<br>明るい雰囲気の中にも暖かさを演出" };
function lightColorBlock(code: string, blockNo: string, tds: LcTd[], opt: { lead?: string; firstTtlIndent?: string; firstTxtTag?: string } = {}): string {
  let s = `${opt.lead ?? ""}<div id="light_color_block${blockNo}" class="light_color_block block01">\r\n`;
  s += `  <table class="table_light_color">\r\n  <tr>\r\n`;
  tds.forEach((td, i) => {
    const ttlIndent = i === 0 && opt.firstTtlIndent != null ? opt.firstTtlIndent : "    ";
    const tag = i === 0 && opt.firstTxtTag ? opt.firstTxtTag : "p";
    s += `  <td class="${td.cls}">\r\n`;
    s += `${ttlIndent}<p class="light_color_ttl">${td.ttl}</p>\r\n`;
    s += `    <p class="light_color_img">${lazyImg(`${ICON}light_color_${code}_${pad(i + 1, 2)}.jpg`, `alt="${td.alt}" width="218" height="286"`)}</p>\r\n`;
    s += `    <${tag} class="light_color_txt">${td.txt}</${tag}>\r\n`;
    s += `  </td>\r\n`;
  });
  s += `  </tr>\r\n  </table>\r\n`;
  s += `  <p class="light_color_txt01">※写真はイメージです。ご使用の環境により色味や雰囲気は異なります。</p>\r\n`;
  s += `</div><!--//light_color_block${blockNo}-->\r\n`;
  return s;
}

export function cfComment13(p: ProductFull): string {
  const f = p.fanAttrs;
  const light = cfHasLight(p);
  const single = cfIsSingleOption(p);
  const cells = cfImageCells(p);
  const cell = (i: number) => cells[i] ?? "";
  const itemImg = (file: string) => `${FS_CMS_ITEM_IMGPATH}${cfImgFolder(file)}/${file}`;
  const alt = cfPageTitle(p);
  let s = "";

  // ご注文はこちらから
  if (cfArrival(p) !== "生産終了") {
    s +=
      `<div class="btn_block01 free_block01">\r\n` +
      `  <p class="btn_gocart01"><a href="#product_cart_area"><span>ご注文はこちらから</span></a></p>\r\n` +
      `</div><!--//btn_block01-->\r\n\r\n`;
  }

  // メーカー名
  s += `<div id="manufacturer_block01" class="free_block01">\r\n<h3 class="ttl_line01">メーカー名</h3>\r\n<ul class="clearfix">\r\n`;
  s += `  <li>${lazyImg(`${FS_CMS_ITEM_IMGPATH}etc/${cfMaker(p, 12)}`, cfMaker(p, 15))}</li>\r\n`;
  if (p.countryOfOrigin === "Japan") {
    s += `  <li>${lazyImg(`${FS_CMS_ITEM_IMGPATH}etc/madeinjapan-cf_01.jpg`, `alt="信頼の国内生産品" width="176" height="40"`)}</li>\r\n`;
  }
  if (p.goodDesignYear === 2015) {
    s += `  <li>${lazyImg(`${FS_CMS_ITEM_IMGPATH}etc/gooddesignaward2015_01.gif`, `alt="グッドデザイン賞2015受賞商品" width="200" height="40"`)}</li>\r\n`;
  }
  s += `</ul>\r\n</div><!--//manufacturer_block01-->\r\n\r\n`;

  // 商品特徴(機能アイコン)
  if (!single) {
    let icon = cfFunctionIcons(p);
    icon = icon.split("<img src=").join(`  <li><img class="lazyload" src="${LAZY_SRC}" data-src=`);
    icon = icon.split(`">\r\n`).join(`" width="80" height="80"></li>\r\n`);
    s += `<div id="features_block01" class="free_block01">\r\n<h3 class="ttl_line01">商品特徴</h3>\r\n<ul class="clearfix">\r\n`;
    s += icon;
    s += `</ul>\r\n</div><!--//features_block01-->\r\n\r\n`;
  }

  // オリジナル延長パイプ
  const mount = f?.mountType ?? "";
  if (mount === "加工パイプ") {
    s +=
      `<div id="extension_block01" class="free_block01">\r\n` +
      `  <h3><span>重要</span>ファズーオリジナル延長パイプについて</h3>\r\n` +
      `  <p>こちらのパイプは安全性を確認した上で、メーカー純正のパイプを加工しております。</p>\r\n` +
      `  <p>加工後も構造や設置方法は変わりませんので、安全上の問題はございません。</p>\r\n` +
      `</div><!--//extension_block01-->\r\n\r\n`;
  }

  // この商品の別のバリエーション
  let vtag = "";
  if (!single) {
    let fan = component(p, "FAN") || (p.modelNumber ?? "");
    if (fan) {
      if (fan.includes("(")) fan = fan.slice(0, fan.indexOf("("));
      fan = `F${fan}%20`;
    }
    const fx = (m: string) => (m ? `F${m}%20` : "");
    const lightModel = component(p, "LIGHT");
    const lightKey = lightModel ? `F${lightModel}%20` : light ? "" : "%3bF1%20";
    const pipe = fx(component(p, "PIPE"));
    const remote = fx(component(p, "REMOTE"));
    const wing = fx(component(p, "BLADE"));
    const option = fx(component(p, "OPTION"));
    const li = (kw: string, file: string, a: string) =>
      `  <li><p><a href="https://www.fazoo.biz/p/search?keyword=${kw}&sort=priority" class="variation-box">${lazyImg(`${ICON}${file}`, `alt="${a}" width="469" height="141"`)}</a></p>\r\n` +
      `      <p class="kome01">※オプションの設定が無い商品もございますのでご了承ください。</p>\r\n` +
      `  </li>\r\n`;
    vtag += `<div id="variation_block01" class="free_block01">\r\n<h3 class="ttl_line01">この商品の別のバリエーション</h3>\r\n<ul class="clearfix">\r\n`;
    if (lightModel) vtag += li(`${fan}${pipe}${remote}${wing}${option}%3bL1`, "variation-light.png", "照明の種類違い一覧");
    if ((f?.pipeVariation ?? "") === "○") vtag += li(`${fan}${lightKey}${remote}${wing}${option}`, "variation-pipe.png", "吊り下げパイプの長さ違い一覧");
    vtag += `</ul>\r\n</div><!--//variation_block01-->\r\n`;
  }
  if (vtag.length > 160) s += `${vtag}\r\n`;

  // フリーHTMLゾーン(FS動画HTML) → フリーHTML2(セル値そのまま)
  s += cell(IMG_COL.MV_FS);
  s += cell(IMG_COL.FHtml2);

  // メインイメージ2
  const m2 = cell(IMG_COL.M2);
  if (m2) {
    s += `<div class="sub_img_block01 free_block01">\r\n`;
    s += `  <p>${lazyImg(itemImg(m2), `alt="${alt}" ${sizeAttr(m2)}`)}</p>\r\n`;
    s += `</div><!--//sub_img_block01-->\r\n\r\n`;
  }

  // 設置事例(イメージ画像1〜10)
  const images = cells.slice(IMG_COL.I1, IMG_COL.I10 + 1).filter((v): v is string => !!v);
  const exampleUrl = "exampleUrlRaw" in cfExtra(p) ? exs(p, "exampleUrlRaw") : (p.exampleUrl ?? "");
  s += `<div id="example_block01" class="free_block01">\r\n`;
  if (images.length > 0) {
    s += `<h3 class="ttl_line01">設置事例</h3>\r\n<ul class="img_box01">\r\n`;
    for (const im of images) s += `  <li>${lazyImg(itemImg(im), `alt="${alt}" ${sizeAttr(im)}`)}</li>\r\n`;
    s += `</ul>\r\n\r\n`;
    if (exampleUrl) s += `<p class="btn_example01"><a href="https://www.fazoo.biz/example/${exampleUrl}/" target="_blank">事例写真をもっと見る</a></p>\r\n`;
  } else if (exampleUrl) {
    s += `<h3 class="ttl_line01">設置事例</h3>\r\n`;
    s += `<p class="btn_example01"><a href="https://www.fazoo.biz/example/${exampleUrl}/" target="_blank">事例写真を見る</a></p>\r\n`;
  }
  s += `</div><!--//example_block01-->\r\n\r\n`;

  // サイズ詳細
  s += `<div id="size_block01" class="free_block01">\r\n`;
  const sizes = [cell(IMG_COL.S1), cell(IMG_COL.S1 + 1)];
  if (sizes.some(Boolean)) {
    s += `<h3 class="ttl_line01">サイズ詳細</h3>\r\n\r\n`;
    for (const sz of sizes) {
      if (sz === "CUSTOM-SIZE") {
        const pipeCell = exCell(p, "pipeLengthCell") ?? f?.extensionPipe ?? null;
        const pipe = variantNum(pipeCell);
        const pipeImage = pipeCell == null || pipeCell === "" || pipe === 0 ? 0 : pipe <= 15 ? 1 : 2;
        const base = light ? "fanlightsize" : "fansize";
        const file = [`${base}.gif`, `${base}-15cm_over.gif`, `${base}-30cm_over.gif`][pipeImage];
        s += `<div class="size-set">\r\n<div class="size-set_inner01">\r\n`;
        s += `<p>${lazyImg(`${ICON}${file}`, `alt="サイズ寸法" width="320" height="190"`)}</p>\r\n`;
        s += `<ul>\r\n`;
        // VBAは幅・高さ・羽根の高さのいずれかが空だとエラー停止→続行で 0 のまま出力される
        const ok = p.widthMm != null && p.heightMm != null && f?.heightToBladeMm != null;
        s += `  <li class="fansize fan-width">${ok ? vbRound(widthNum(p)) : 0}</li>\r\n`;
        s += `  <li class="fansize fan-height">${ok ? vbRound(heightNum(p)) : 0}</li>\r\n`;
        s += `  <li class="fansize fan-towing">${ok ? f?.heightToBladeMm : 0}</li>\r\n`;
        s += `</ul>\r\n</div><!--//size-set_inner01-->\r\n</div><!--//size-set-->\r\n\r\n`;
      } else if (sz) {
        s += `<ul class="img_box01">\r\n`;
        s += `  <li>${lazyImg(itemImg(sz), `alt="サイズ画像" ${sizeAttr(sz)}`)}</li>\r\n`;
        s += `</ul>\r\n`;
      }
    }
    s += `\r\n`;
  }
  // 機能イメージ1〜3
  const funcs = cells.slice(IMG_COL.F1, IMG_COL.F3 + 1).filter((v): v is string => !!v);
  if (funcs.length > 0) {
    s += `<ul class="img_box01">\r\n`;
    for (const fi of funcs) s += `  <li>${lazyImg(itemImg(fi), `alt="${alt}" ${sizeAttr(fi)}`)}</li>\r\n`;
    s += `</ul>\r\n\r\n`;
  }
  s += `</div><!--//size_block01-->\r\n`;

  // リモコン付属・付属品
  s += `<div id="controller_block01" class="free_block01">\r\n`;
  const r1 = cell(IMG_COL.R1);
  if (r1) {
    s += `<h3 class="ttl_line01">リモコン付属</h3>\r\n<ul class="img_box01">\r\n`;
    s += `  <li>${lazyImg(itemImg(r1), `alt="${alt}" ${sizeAttr(r1)}`)}</li>\r\n`;
    s += `</ul>\r\n\r\n`;
  }
  const e1 = cell(IMG_COL.E1);
  if (e1) {
    s += `<ul class="img_box01">\r\n`;
    s += `  <li>${lazyImg(itemImg(e1), `alt="${alt}" ${sizeAttr(e1)}`)}</li>\r\n`;
    s += `</ul>\r\n\r\n`;
  }
  s += `</div><!--//controller_block01-->\r\n`;

  // 効果
  s += `<div id="effect_block01" class="free_block01">\r\n`;
  if (!single) {
    s += `<h3 class="ttl_line01">効果</h3>\r\n\r\n`;
    s += `<div id="circulation_block01" class="block01">\r\n<ul class="img_box02 clearfix">\r\n`;
    s += `  <li>${lazyImg(`${ICON}circulation_summer.png`, `alt="シーリングファンのサーキュレーション効果" width="480" height="410"`)}</li>\r\n`;
    s += `  <li>${lazyImg(`${ICON}circulation_winter.png`, `alt="シーリングファンのサーキュレーション効果" width="480" height="410"`)}</li>\r\n`;
    s += `</ul>\r\n`;
    s += `<p class="circulation_txt01">住宅の気密化が進み、室内の快適空調への要求がますます高まる中で、シーリングファンのもつ優れた特性は注目されています。エアコンとシーリングファンを併用することで、エアコン運転だけの場合と比べ、冷暖房費が大幅に節減できます。シーリングファンを使用し室内の温度を均一な環境にすることで、エアコンの温度設定も低めに設定できます。</p>\r\n`;
    s += `</div><!--//circulation_block01-->\r\n\r\n`;
  }
  if (light) {
    const tatami = exNum(p, "tatamiToRaw") ?? (f?.tatamiTo ?? 0);
    const lumen = exNum(p, "lumenRaw") ?? (f?.brightnessLm ?? 0);
    if (tatami < 10 || lumen < 3000) {
      s += `<div id="brightness_block01" class="block01">\r\n<ul class="clearfix">\r\n`;
      s += `  <li>${lazyImg(`${ICON}brightness-ceilingfan-light_text.png`, `alt="シーリングファンライトンの明るさ選び 照明は明るくしたい範囲で決めます。リビングが10畳でも、ダウンライトやダイニング照明、他の明かりがある場合は、シーリングファンの照明には6畳がちょうど良い明るさになります。" width="438" height="317"`)}</li>\r\n`;
      s += `  <li>${lazyImg(`${ICON}brightness-ceilingfan-light_img.png`, `alt="シーリングファンライトンの明るさ選び" width="438" height="317"`)}</li>\r\n`;
      s += `</ul>\r\n</div><!--//brightness_block01-->\r\n\r\n`;
    }
  }
  const vimg = exs(p, "variationImageRaw") || (p.variations.find((v) => v.variationNo === 1)?.imageName ?? "");
  const std = [LC_DENKYU, LC_CHUHAKU, LC_CHUKO];
  if (vimg === "light_color_l.jpg") s += lightColorBlock("l", "01", std, { firstTtlIndent: "  ", firstTxtTag: "dd" });
  else if (vimg === "light_color_n.jpg") s += lightColorBlock("n", "02", std, { lead: "  " });
  else if (vimg === "light_color_ln.jpg") s += lightColorBlock("ln", "03", std);
  else if (vimg === "light_color_ld.jpg") s += lightColorBlock("ld", "04", std);
  else if (vimg === "light_color_lnd.jpg") s += lightColorBlock("lnd", "05", std);
  else if (vimg === "light_color_lwn.jpg") s += lightColorBlock("lwn", "05", [LC_DENKYU, LC_ONPAKU, LC_CHUHAKU]);
  s += `</div><!--//effect_block01-->\r\n`;

  // 掃除道具バナー(パイプ吊り下げ)
  const pipeLen = variantNum(exCell(p, "pipeLengthCell") ?? f?.extensionPipe ?? null);
  if (mount === "パイプ" && (pipeLen > 0 || Number.isNaN(pipeLen))) {
    s +=
      `<div id="ductclean_block01" class="free_block01">\r\n` +
      `  <p class="btn_dustclean01"><a href="https://www.fazoo.biz/c/option/option_clean">${lazyImg(`${ICON}azuma_AG464_B1.png`, `alt="シーリングファン用の掃除道具（用具）一覧" width="560" height="112"`)}</a></p>\r\n` +
      `</div><!--//ductclean_block01-->\r\n`;
  }
  return `${cfBanner("↓↓", 13)}${s}${cfBanner("↑↑", 13)}\r\n`;
}
