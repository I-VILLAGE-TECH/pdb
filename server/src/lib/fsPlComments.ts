// futureshop 商品CSV(PL版)の独自コメント(2)〜(9) HTML生成
// 現行VBA(pendantlight/modules/futureshop商品CSV.bas)の出力を再現する。
// テンプレートは実出力CSV(documents/tmp のPL_FS商品データ)と突合してバイト単位で合わせている。
// 残ギャップ: 2つ目以降の電球タブの本文(子バリエーション行の機能詳細。DB未取込)
import type { Prisma } from "@prisma/client";

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

// 関連商品(独自コメント(8))。generateRows が事前ロードしてセットする
export type PlRelated = {
  productCode: string;
  name: string;
  category: string;
  displayModelNumber: string | null; // イメージ名フォールバック判定用
  installationType: string | null;
  mainImage: string | null;
  extra?: unknown; // itemType / sheet / opCategory(ALTの「製○○」に使う)
};
let relatedMap = new Map<string, PlRelated[]>();
export function setPlRelated(map: Map<string, PlRelated[]>) {
  relatedMap = map;
}
// 関連商品のグループキー: メーカー+通し番号(現行のICOL_ID_Maker & ICOL_ID_Num)。
// どちらか欠けている場合は商品コードの前方一致で代用
export function plRelKey(makerId: number | null, seqNo: number | null, productCode: string): string {
  if (makerId != null && seqNo != null) return `${makerId}:${seqNo}`;
  return productCode.match(/^[A-Z]+-\d+/)?.[0] ?? productCode;
}

const IMG_BASE = "/pl_item_img";

function isDiscontinuedPl(p: { status: string }): boolean {
  return p.status === "DISCONTINUED" || p.status === "DISCONTINUED_IN_STOCK" || p.status === "HIDDEN";
}

// メーカーコード → ロゴファイル名(現行のtypo「artwaorkstudio」も踏襲) / カテゴリURL
const MAKER_LOGOS: Record<string, string> = {
  AP: "logo_ampersand.png", AW: "logo_artwaorkstudio.png", DA: "logo_daiko.png",
  DC: "logo_diclasse.png", EX: "logo_elux.png", GL: "logo_gotoh.png",
  HM: "logo_hermosa.png", IF: "logo_interform.png", KO: "logo_koizumi.png",
  MX: "logo_maxray.png", MR: "logo_mercros.png", OD: "logo_odelic.png",
  OB: "logo_orrb.png", PN: "logo_panasonic.png", SW: "logo_swan.png",
  TM: "logo_tokyometal.png", TO: "logo_toshiba.png", GE: "logo_grameight.png",
};
const MAKER_URLS: Record<string, string> = {
  AP: "/c/ampersand", AW: "/c/artworkstudio", DA: "/c/daiko", DC: "/c/diclasse",
  EX: "/c/elux", GL: "/c/gotoh", HM: "/c/hermosa", IF: "/c/interform",
  KO: "/c/koizumi", MX: "/c/maxray", MR: "/c/mercros", OD: "/c/odelic",
  OB: "/c/orrb", PN: "/c/panasonic", SW: "/c/swan", TM: "/c/tome",
  TO: "/c/toshiba", GE: "/c/grameight",
};

function imgFolder(p: ProductFull): string {
  return p.maker?.imgFolder ?? "";
}
// ページ名・画像ALT用の種別語尾(現行のページ名/SetImgAlt: 商品種別で「ペンダントライト」を置換。OP/ACはオプション)
const PAGE_SUFFIX: Record<string, string> = {
  PL: "製ペンダントライト",
  CL: "製シーリングライト",
  LR: "製ライティングレール",
  AC: "製オプション",
  OP: "製オプション",
  CF: "製シーリングファン",
};
type PlExtraSource = { category: string; extra?: unknown };
function plExtraOf(p: PlExtraSource): Record<string, unknown> {
  return (p.extra ?? {}) as Record<string, unknown>;
}
export function plPageSuffix(p: PlExtraSource): string {
  const itemType = plExtraOf(p).itemType;
  if (typeof itemType === "string" && PAGE_SUFFIX[itemType]) return PAGE_SUFFIX[itemType];
  return p.category === "CEILING_LIGHT" ? "製シーリングライト" : p.category === "CEILING_FAN" ? "製シーリングファン" : "製ペンダントライト";
}
// その他別管理一覧FS(VBAの gsActivesheetName = ETCITEM_DATA)由来の商品か
function isOtherSheet(p: PlExtraSource): boolean {
  return plExtraOf(p).sheet === "other";
}
function opCategoryOf(p: PlExtraSource): string {
  const c = plExtraOf(p).opCategory;
  return typeof c === "string" ? c : "";
}
// 画像ALTの語尾(SetImgAlt): その他別管理一覧FSは「製」+その他管理用カテゴリ1(例: 製オプション部品)
export function plAltSuffix(p: PlExtraSource): string {
  const x = plExtraOf(p);
  if (x.sheet === "other") return `製${opCategoryOf(p)}`;
  return plPageSuffix(p);
}
// イメージ名の有無(VBAの ICOL_ImgName <> "")。name はイメージ名が空なら掲載用型番(trim済み)で補完されるため、
// 掲載用型番の生値・trim値のどちらとも違う場合だけイメージ名ありとみなす(掲載用型番の末尾スペース対策)
export function plHasImageName(x: { name: string; displayModelNumber: string | null }): boolean {
  return x.name !== x.displayModelNumber && x.name !== x.displayModelNumber?.trim();
}
// 画像ALT(独自コメント(20)と同じ): イメージ名 メーカー製ペンダントライト 代表型番 商品コード
export function altBase(p: ProductFull): string {
  const model = p.variations.find((v) => v.isRepresentative)?.modelNumber ?? "";
  const imageName = plHasImageName(p) ? `${p.name} ` : "";
  return `${imageName}${p.maker?.nameJp ?? ""}${plAltSuffix(p)} ${model} ${p.productCode}`;
}
// スライダー対象画像(メイン+イメージ。サイズ/機能は除く)。取込時のスロット順=シート列順
function sliderImages(p: ProductFull) {
  return [
    ...p.images.filter((i) => i.imageType === "MAIN").sort((a, b) => a.sortNo - b.sortNo),
    ...p.images.filter((i) => i.imageType === "IMAGE").sort((a, b) => a.sortNo - b.sortNo),
  ];
}
function functionImages(p: ProductFull) {
  return p.images.filter((i) => i.imageType === "FUNCTION").sort((a, b) => a.sortNo - b.sortNo);
}

// (3)〜(9)のバナー。closeNo が open と違う枠がある(現行VBAのコピペずれを踏襲)
const plusBanner = (dir: "↓↓" | "↑↑", n: number) =>
  `<!-- ++++++++++++++++++++++++++\n  ${dir}独自コメント（${n}）${dir}\n++++++++++++++++++++++++++++ -->`;
function wrapPlus(n: number, body: string, closeNo = n): string {
  if (!body) return `${plusBanner("↓↓", n)}\n\n${plusBanner("↑↑", closeNo)}\n`;
  return `${plusBanner("↓↓", n)}\n\n${body}\n${plusBanner("↑↑", closeNo)}\n`;
}

// バリエーションの電球種別を分解: "LED調光・非調色位相制御" → kind=LED, mode=調光・非調色, method=位相制御
function parseBulbOption(opt: string | null): { kind: string; mode: string; method: string } {
  let s = opt ?? "";
  let method = "";
  for (const m of ["位相制御", "PWM", "Bluetooth", "リモコン"]) {
    if (s.endsWith(m)) {
      method = m;
      s = s.slice(0, -m.length);
      break;
    }
  }
  const kinds = ["白熱球", "LED", "蛍光灯"];
  const kind = kinds.find((k) => s.startsWith(k)) ?? "";
  return { kind, mode: s.slice(kind.length), method };
}

// ============== 独自コメント(2): メイン画像スライダー+サムネイル ==============
export function plComment02(p: ProductFull): string {
  const alt = altBase(p);
  const folder = imgFolder(p);
  const imgs = sliderImages(p);
  const main = imgs
    .map(
      (i) =>
        `  <div class="main_slide"><img src="${IMG_BASE}/${folder}/${i.fileName}" alt="${alt}" width="768" height="768"></div>`
    )
    .join("\n");
  const thumbs = imgs
    .map(
      (i) =>
        `  <div class="thm_slide"><img src="${IMG_BASE}/${folder}/${i.fileName}" alt="${alt}" width="100" height="100"></div>`
    )
    .join("\n");
  const banner = (dir: "↓↓" | "↑↑") =>
    `<!-- ---------------------------------------------\n ************${dir}独自コメント（02）${dir} ************\n--------------------------------------------- -->`;
  return `${banner("↓↓")}\n<div id="product_slide_box" class="mainslide">\n${main}\n</div><!--//product_slide_box-->\n\n<div class="product_thumbnail">\n${thumbs}\n</div><!--//product_thumbnail-->\n\n${banner("↑↑")}\n\n`;
}

// ============== 独自コメント(3): 取付方法タグ ==============
export function plComment03(p: ProductFull): string {
  // その他別管理一覧は取付方法ではなく商品ジャンル(その他管理用カテゴリ1)を表示
  const inst = isOtherSheet(p) ? opCategoryOf(p) : (p.lightingAttrs?.installationType ?? "");
  // 閉じバナーが（4）なのは現行踏襲
  return wrapPlus(3, `<ul class="tag_label"> \n<li>${inst}</li>\n</ul>`, 4).replace("</ul>\n<!--", "</ul>\n<!--");
}

// ============== 独自コメント(4): %OFF表示 ==============
export function plComment04(p: ProductFull): string {
  const list = p.listPriceInTax ?? 0;
  const total = p.totalPrice ?? p.sellingPrice ?? 0;
  let body = "";
  if (list > 0 && total > 0 && list > total) {
    const off = ((1 - total / list) * 100).toFixed(1);
    body = `<div class="price-down">\n<span>${off}% OFF</span>\n</div>\n`;
  }
  if (!body) return `${plusBanner("↓↓", 4)}\n\n\n${plusBanner("↑↑", 4)}\n`;
  return wrapPlus(4, body);
}

// ============== 独自コメント(5): メイン紹介文+取付タイプ+カートボタン ==============
const INSTALL_IMAGES: Record<string, [string, string, number]> = {
  // 取付タイプ → [画像ファイル, alt, height](VBA futureshop商品CSV.bas:1140-1146)
  簡易取付: ["toritsuke_kani.jpg", "簡易取付タイプ", 492],
  直付取付: ["toritsuke_installation.png", "直付取付タイプ", 298],
  レール取付: ["toritsuke_duct.jpg", "ダクトレール取付タイプ", 486],
  "埋込・直付取付": ["toritsuke_umekomi_kenyo.jpg", "埋込・直付取付タイプ", 588],
};
export function plComment05(p: ProductFull): string {
  const comment = (p.comment ?? "").replace(/\r\n/g, "<br>\n");
  const inst = p.lightingAttrs?.installationType ?? "";
  const installImage = p.lightingAttrs?.installImage;
  // 取付画像名の列に値があればそれを優先(altは現行どおり「簡易取付タイプ」固定・高さ500)
  const imgTag = installImage
    ? `<p class="t-center"><img src="/pl_img/products_detail/${installImage}.png" alt="簡易取付タイプ" width="700" height="500"></p>\n`
    : INSTALL_IMAGES[inst]
      ? `<p class="t-center"><img src="/pl_img/products_detail/${INSTALL_IMAGES[inst][0]}" alt="${INSTALL_IMAGES[inst][1]}" width="700" height="${INSTALL_IMAGES[inst][2]}"></p>\n`
      : "";
  // その他別管理一覧では取付タイプブロックを出さない
  const toritsuke = imgTag && !isOtherSheet(p)
    ? `<div id="toritsuke_type" class="detail_block01">\n<h3 class="ttl_line01">取付タイプ</h3>\n${imgTag}</div><!--//toritsuke_type-->\n`
    : "";
  const body = `<div id="products_comment" class="detail_block01">\n<p>${comment}</p></div><!--//products_comment-->\n\n\n${toritsuke}\n\n\n<div class="btn_block01 detail_block01">\n  <p class="btn_gocart01"><a href="#product_cart_area"><span>ご注文はこちらから</span></a></p>\n</div><!--//btn_block01-->\n`;
  return wrapPlus(5, body);
}

// ============== 独自コメント(6): 商品詳細+電球タブ+設置事例+機能説明 ==============
// キーは電球種類2+電球の種類の連結(VBAのSelect Case値)
const TAB_LEADS: Record<string, string[]> = {
  LED非調光: ["あかりの色や明るさを", "操作しない", "スタンダードなタイプ"],
  "LED調光・非調色": ["生活シーンにあわせて", "あかりの明るさを", "自由に調節"],
  "LED調光・調色": ["生活シーンにあわせて", "あかりの色と明るさの両方を", "自由に調節"],
  "LED自動調光・調色": ["時間の経過にあわせて", "自動でコントロール"],
  白熱球: ["柔らかく暖かみのある", "色が特徴"],
  電球なし: ["付属電球なし"],
};
// タブの説明文(VBAの調光方式別Select Caseの再現)。typeLabel=調光・非調色/調光・調色/自動調光・調色、
// dimming=調光方法1列(Bluetooth/位相制御/PWM/リモコン/単体)
function dimmerExplanation(typeLabel: string, dimming: string): string {
  const head = (x: string) =>
    `        <p>こちらの${typeLabel}タイプの商品は、<span class="t-bolder f_red">${x}</span>の商品です。</p>`;
  const bold = (x: string) => `        <p><span class="t-bolder f_red">${x}</span>です。</p>`;
  const boldRaw = (x: string) => `        <p><span class="t-bolder f_red">${x}</span></p>`;
  const plain = (x: string) => `        <p>${x}</p>`;
  const WALL = plain("壁スイッチがON／OFF機能のみであることをご確認ください。");
  const NO_REMOTE = plain("リモコンなどがなくても照明器具としてご利用いただけます。");
  const NO_DEVICE = plain("調光器がなくても照明器具としてご利用いただけます。");
  const DEVICE_USE = plain("調光機能をご利用の場合、別途専用の調光器をご用意ください。");
  const auto = typeLabel === "自動調光・調色";
  let lines: string[];
  switch (dimming) {
    case "Bluetooth":
      lines = auto
        ? [head("Bluetooth調光・調色"), boldRaw("専用のリモコンで自動調光・調色。"), bold("リモコンは別売り"), WALL, NO_REMOTE]
        : typeLabel === "調光・非調色"
          ? [head("Bluetooth対応"), bold("リモコンなどで調光可能"), WALL, NO_REMOTE]
          : [head("Bluetooth調光・調色"), bold("リモコンなどで調光可能"), WALL, NO_REMOTE];
      break;
    case "位相制御":
      lines = [head("調光器対応"), bold("調光器は別売り"), DEVICE_USE, NO_DEVICE];
      break;
    case "PWM":
      lines = [head("調光器対応"), bold("「調光器」「信号線」は別売り"), DEVICE_USE, NO_DEVICE];
      break;
    case "リモコン":
      lines = auto
        ? [head("リモコン対応"), boldRaw("専用のリモコンで自動調光・調色。"), bold("リモコンは別売り"), WALL, NO_REMOTE]
        : [head("リモコン対応"), WALL, NO_REMOTE];
      break;
    case "単体":
      lines = [
        head("本体スイッチ操作タイプ"),
        WALL,
        plain(typeLabel === "調光・非調色" ? "調光切り替えは、本体スイッチにて変更してご利用いただけます。" : "調光・調色切り替えは、本体スイッチにて変更してご利用いただけます。"),
      ];
      break;
    default:
      // 現行はBluetooth相当の文言が最多。未設定行は従来どおりBluetooth扱い
      lines =
        typeLabel === "調光・非調色"
          ? [head("Bluetooth対応"), bold("リモコンなどで調光可能"), WALL, NO_REMOTE]
          : [head("Bluetooth調光・調色"), bold("リモコンなどで調光可能"), WALL, NO_REMOTE];
  }
  return `      <div class="tab_cont_explanation">\n${lines.join("\n")}\n      </div><!--//tab_cont_explanation-->\n`;
}

// 行の電球種類2(kind)と電球の種類(typ)。専用カラム未取込データはoptionValueから分解して代用
function rowBulb(p: ProductFull, v: ProductFull["variations"][number]): { kind: string; typ: string } {
  if (v.bulbKind2 != null || v.bulbType != null) return { kind: v.bulbKind2 ?? "", typ: v.bulbType ?? "" };
  const parsed = parseBulbOption(v.optionValue);
  return { kind: parsed.kind || parsed.mode, typ: parsed.kind ? parsed.mode : "" };
}
// VBAのlBitFlg再現(futureshop商品CSV.bas: HiChoko=1 ChokoChoshoku=2 Choko=4 Choshoku=8
// FullCollar=16 Hakunetsu=32 DenkyuNashi=64 AutoChoko=128)。キーは電球種類2+電球の種類の連結
const BULB_FLAGS: Record<string, number> = {
  LED非調光: 1,
  "LED調光・調色": 2,
  "LED自動調光・調色": 128,
  "LED調光・非調色": 4,
  LED調色: 8,
  LEDフルカラー: 16,
  白熱球: 32,
  電球なし: 64,
  付属電球なし: 64,
};
// choko画像判定(VBAのif/elseifチェーン。全フラグの完全一致で分岐しているのでマスク→画像のMapで再現)
const CHOKO_BY_MASK = new Map<number, [string, string]>([
  [1, ["choko01.jpg", "LED非調光"]],
  [3, ["choko02.jpg", "LED非調光 LED調光・調色"]],
  [131, ["choko02.jpg", "LED非調光 LED調光・調色"]],
  [129, ["choko02.jpg", "LED非調光 LED調光・調色"]],
  [5, ["choko03.jpg", "LED非調光 LED調光"]],
  [130, ["choko04.jpg", "LED調光・調色"]],
  [4, ["choko05.jpg", "LED調光"]],
  [8, ["choko06.jpg", "LED調色"]],
  [147, ["choko07.jpg", "LED非調光 LED調光・調色 LEDフルカラー"]],
  [134, ["choko08.jpg", "LED調光・調色 LED調光"]],
  [139, ["choko09.jpg", "LED非調光 LED調光・調色 LED調色"]],
  [33, ["choko10.jpg", "LED非調光 白熱球"]],
  [97, ["choko11.jpg", "LED非調光 白熱球 付属電球なし"]],
  [65, ["choko12.jpg", "LED非調光 付属電球なし"]],
  [96, ["choko13.jpg", "白熱球 付属電球なし"]],
  [32, ["choko14.jpg", "白熱球"]],
  [64, ["choko15.jpg", "付属電球なし"]],
  [6, ["choko16.jpg", "LED非調光 LED調光・調色"]], // altは現行VBAのまま(実際の組合せはLED調光・調色+LED調光)
  [2, ["choko17.jpg", "LED調光・調色"]],
]);

// 形 → [URLスラッグ, alt表記](VBA SetIconTag。丸のみaltが「丸・球」)
const SHAPE_ICONS: Record<string, [string, string]> = {
  丸: ["form_circle", "丸・球"],
  半円: ["form_semicircle", "半円"],
  "縦長半円・縦長三角": ["form_vertical", "縦長半円・縦長三角"],
  三角: ["form_triangle", "三角"],
  傘型: ["form_umbrella", "傘型"],
  "四角形・長方形": ["form_square", "四角形・長方形"],
  台形: ["form_trapezoid", "台形"],
  縦長四角: ["form_rectangle", "縦長四角"],
  裸電球: ["form_naked", "裸電球"],
  雫型: ["form_drop", "雫型"],
  多灯: ["form_multiple", "多灯"],
  シャンデリア: ["form_chandelier", "シャンデリア"],
  横長: ["form_line", "横長"],
  "個性的・その他デザイン": ["form_other", "個性的・その他デザイン"],
};

// タブ内アイコン(VBA SetIconTagの再現)。行ごとの値(v)があれば電球1・灯数はその行の値のみを使う。
// 形の<li>だけ改行なしで次のアイコンが同一行に続く、末尾に余分な<ul>が付く等のVBAの出力ぐせも踏襲
function featureIcons(p: ProductFull, kindOverride?: string, v?: ProductFull["variations"][number]): string {
  const a = p.lightingAttrs;
  const icon = (file: string, iconAlt: string) =>
    `          <li><img src="/pl_img/products_icon/icon_${file}.png" width="74" height="74" alt="${iconAlt}"></li>\n`;
  let out = "\n";
  out += `      <div class="product_feature_icon">\n`;
  out += `        <ul>\n`;
  // 3年保証(行の保証列)
  const warranty = v ? (v.warrantyFlag ?? "") : (p.warranty ?? "");
  if (warranty === "○") out += icon("warranty", "3年保証");
  // 形(行のカテゴリ形列。改行なし)
  const shape = v ? (v.shape ?? "") : (((a?.tags as Record<string, string> | null)?.shape ?? "") as string);
  const sh = SHAPE_ICONS[shape];
  if (sh)
    out += `          <li class="icon_link01"><a href="/c/${sh[0]}"><img src="/pl_img/products_icon/icon_${sh[0]}.png" width="74" height="74" alt="形から探す ${sh[1]}"></a></li>`;
  // 取り付けタイプ(行の取付方法列)
  const edw = v ? (v.installEdw ?? "") : (a?.installationCode ?? "");
  if (edw === "E") out += icon("setup_easy", "簡易取り付けタイプ");
  else if (edw === "D") out += icon("setup_rail", "レール取付");
  else if (edw === "W") out += icon("setup_construction", "直付取付");
  // 付属電球(行の電球1)
  const bulb1 = v ? (v.bulbReplacement ?? "") : (a?.bulbReplacement ?? "");
  if (bulb1 === "電球同梱") out += icon("light_koukan", "電球同梱");
  else if (bulb1 === "一体型") out += icon("light_koukan_no", "一体型");
  else if (bulb1 === "電球同梱無し" || bulb1 === "同梱電球無し") out += icon("light_no", "同梱電球無し");
  // 灯数(行のメイン電球数)
  const count = v ? (v.mainBulbCount ?? 0) : (a?.mainBulbCount ?? 0);
  if (count >= 1 && count <= 30) out += icon(`socket${String(count).padStart(2, "0")}`, `${count}灯`);
  // 電球の種類
  const kind2 = kindOverride || (a?.bulbKind ?? "");
  if (kind2 === "LED") out += icon("light_led", "LED");
  else if (kind2 === "白熱球") out += icon("light_hakunetsu", "白熱球");
  else if (kind2.includes("電球なし")) out += " \n";
  out += `        </ul>\n`;
  out += `      </div><!--//product_feature_icon-->\n`;
  out += `        <ul>\n`;
  return out;
}

// Excelの数値セルを文字列連結したときの表記(VBAは有効15桁。浮動小数の誤差桁を落とす)
function fmtSize(raw: string): string {
  const n = Number(raw);
  return Number.isFinite(n) && raw.trim() !== "" ? String(parseFloat(n.toPrecision(15))) : raw;
}

export function plComment06(p: ProductFull): string {
  const a = p.lightingAttrs;
  const folder = imgFolder(p);
  const alt = altBase(p);
  const other = isOtherSheet(p);

  // --- 商品詳細情報テーブル ---
  // カラー行: 取込時にbodyColorが色コード(13列)でフォールバックされることがあるため、コード値(英大文字)は現行同様に空扱い
  const colorName = p.bodyColor && !/^[A-Za-z]{1,3}$/.test(p.bodyColor) ? p.bodyColor : "";
  // サイズは取込時の生値(小数あり)を優先。無ければ整数カラム
  const st = (plExtraOf(p).sizeText ?? {}) as Record<string, string | null | undefined>;
  const sz = (raw: string | null | undefined, n: number | null) => (raw != null ? fmtSize(raw) : n != null ? String(n) : null);
  const w = sz(st.width, p.widthMm);
  const d = sz(st.depth, p.depthMm);
  const h = sz(st.height, p.heightMm);
  const hMin = sz(st.totalMin, p.totalHeightMinMm);
  const hMax = sz(st.totalMax, p.totalHeightMaxMm);
  const sizeRow = `幅：${w ?? ""}mm　奥行：${d ?? ""}mm　高さ：${h ?? ""}mm`;
  // 全高: min-max / maxのみ。その他別管理一覧は両方空なら高さで代用(VBA準拠)
  const heightText =
    hMin != null && hMax != null ? `${hMin}-${hMax}` : hMax != null ? hMax : other && h != null ? h : "";
  const heightRow =
    heightText
      ? `  <tr>\n    <th>全高</th>\n    <td>${heightText}mm</td>\n  </tr>\n`
      : "";
  const table = `<div id="products_details" class="detail_block01">
<h3 class="ttl_line01">商品詳細情報</h3>

<table class="product_table">
  <tr>
    <th>メーカー</th>
    <td>
      <p><img src="/pl_img/logo/${MAKER_LOGOS[p.maker?.makerCode ?? ""] ?? `logo_${folder}.png`}" alt="${p.maker?.nameEn ?? ""}" loading="lazy" /></p>
      <p class="link01"><a href="${MAKER_URLS[p.maker?.makerCode ?? ""] ?? `/c/${folder}`}/">このメーカー（${p.maker?.nameJp ?? ""}）の商品一覧を見る</a></p>
    </td>
  </tr>
  <tr>
    <th>商品型番
      <div class="tooltip_box"><img src="/pl_img/products_detail/tooltips.png" alt="？"/>
      <div class="tips01">商品を管理する番号</div></div>
    </th>
    <td>${p.productCode}</td>
  </tr>
  <tr>
    <th>取付タイプ</th>
    <td>${a?.installationType ?? ""}タイプ</td>
  </tr>
  <!--<tr>
    <th>カラー</th>
    <td>${colorName}</td>
  </tr>-->
  <tr>
    <th>サイズ</th>
    <td>${sizeRow}</td>
  </tr>
${heightRow}  <tr>
    <th>口金</th>
    <td>${a?.bulbBase ?? ""}</td>
  </tr>
</table>`;

  // タブは行レベルの○かつ販売終了(E列○)でない行が対象(VBA準拠。全行終了なら空)
  const vars = p.variations
    .filter((v) => v.listed && !v.eosFlag)
    .sort((x, y) => x.variationNo - y.variationNo);

  // その他別管理一覧: 電球タブ・choko画像は出さず、先頭対象行の機能詳細を「仕様」テーブルに入れる。
  // VBAはタブ本文(機能詳細+改行+txtbox閉じ+txt閉じ)からtxtbox閉じ・txt閉じを除去した残り(改行)をそのまま出す
  const specText = other
    ? (vars[0] ? `${(vars[0].detail ?? p.detail ?? "").replace(/\r\n|\r|\n/g, "<br>\n")}\n\n\n\n` : "")
    : "";
  const details = other
    ? `${table}
<table class="product_table sp100">
   <tr>
       <th>仕様</th>
   <td>
${specText}
    </td>
  </tr>
</table>

</div><!--//products_details-->`
    : `${table}

</div><!--//products_details-->`;

  // --- 電球タブ(○行=listedのバリエーションのみ対象) ---
  const radios = vars
    .map((v, i) => `  <input type="radio" name="tab" id="item_0${i + 1}"${v.isRepresentative ? " checked" : ""}>\n`)
    .join("");
  const labels = vars
    .map((v, i) => {
      const { kind, typ } = rowBulb(p, v);
      const color = v.bulbColor ?? "";
      // VBA準拠: 種別も色もなし→種類のみ / 色なし→種類+種別 / それ以外→種類+種別+／色
      const span2 = !typ && !color ? "" : `<span>${typ}</span>`;
      const span3 = color ? `<span>／${color}</span>` : "";
      return `    <li class="tab_item tab_0${i + 1}"><label for="item_0${i + 1}"><span>${i + 1}．${kind}</span>${span2}${span3}</label></li>\n`;
    })
    .join("");
  const tabs = vars
    .map((v, i) => {
      const { kind, typ } = rowBulb(p, v);
      const concat = `${kind}${typ}`; // VBAのSelect Case値(電球種類2+電球の種類)
      const lead = (TAB_LEADS[concat] ?? []).map((t) => `<span>${t}</span>`).join("");
      const dimType = typ === "調光・非調色" || typ === "調光・調色" || typ === "自動調光・調色" ? typ : "";
      const explanation = dimType ? dimmerExplanation(dimType, v.dimming ?? "") : "";
      // タブ本文: バリエーション行ごとの機能詳細(E10対応で取込)。無ければ代表タブのみ商品のdetailで代替
      const raw = v.detail ?? (i === 0 ? p.detail : null) ?? "";
      const body = raw.replace(/\r\n/g, "<br>\n");
      return `    <div class="tab_cont cont_0${i + 1}">
      <h4>${concat}タイプ</h4>
      <div class="tab_cont_lead">
        <p>${lead}</p>
      </div><!--//tab_cont_lead-->
${explanation}${featureIcons(p, kind, v)}      <div class="tab_cont_txt">
      <div class="tab_cont_txtbox">
${body}
</div><!--//tab_cont_txtbox-->
      </div><!--//tab_cont_txt-->
    </div><!--//tab_cont-->
`;
    })
    .join("\n\n\n");
  const tabBlock = `<div id="light_explanation" class="detail_block01">
  <h3 class="ttl_line01">電球（あかり）について<span class="f_red">必ずお読みください</span></h3>
  <p>この商品は下記電球（あかり）タイプがあります。</p>
  <!--<p><span class="marker_yellow f_red">調光や調色を行うには、別途リモコンや調光器をご用意いただく場合があります</span>ので、必ずご確認ください。</p>-->
  <p class="mb015">ご不明な点は当店までお問い合わせください。</p>


<div id="product_tab">
${radios}  <ul class="product_tab_list">
${labels}  </ul><!--//product_tab_list-->

  <div class="product_tab_cont">
${tabs ? `${tabs}\n\n\n` : ""}  </div><!--//product_tab_cont-->
</div><!--//product_tab-->

</div><!--//light_explanation-->    
  `;

  // --- 設置事例・機能説明 ---
  const folderImgs = p.images.filter((i) => i.imageType === "IMAGE" && i.fileName).sort((x, y) => x.sortNo - y.sortNo);
  // VBA準拠のReplace: 設置イメージは .jpg/.jpeg/.png のみ除去(.gifは残る)、機能説明は .gif も除去
  const imgAlt = (fileName: string, exts = [".jpg", ".jpeg", ".png"]) =>
    exts.reduce((t, e) => t.split(e).join(""), fileName).split("_").join(" ");
  const fAlt = (fileName: string) => imgAlt(fileName, [".jpg", ".jpeg", ".png", ".gif"]);
  const images01 = folderImgs.length
    ? `<div id="products_images01" class="products_img detail_block01">
<h3 class="ttl_line01">設置事例　商品説明</h3>
<div class="products_img_slide">
<ul class="slide_box">
${folderImgs
        .map(
          // 連番はVBAの「列-I01列+1」= スロット位置(空きスロットがあっても詰めない)
          (img) =>
            `  <li><img src="${IMG_BASE}/${folder}/${img.fileName}" alt="${alt} ${imgAlt(img.fileName)} 設置イメージ写真${String(img.sortNo).padStart(2, "0")}" width="800" height="800" loading="lazy" /></li>`
        )
        .join("\n")}
</ul>
</div><!--//products_img_slide-->
</div><!--//products_images01-->`
    : "";
  // 機能説明: choko画像(タブ対象行のビットフラグ) + サイズ画像(S01-03) + 機能説明画像(F01-06)
  // 連番はVBAの「列-F01列+1」準拠: サイズ画像は -02/-01/00、機能説明画像は 01..06
  const bit = other ? 0 : vars.reduce((m, v) => {
    const { kind, typ } = rowBulb(p, v);
    return m | (BULB_FLAGS[`${kind}${typ}`] ?? 0);
  }, 0);
  const choko = CHOKO_BY_MASK.get(bit);
  const fmtNo = (n: number) => (n < 0 ? `-${String(-n).padStart(2, "0")}` : String(n).padStart(2, "0"));
  const sizeImgs = p.images.filter((i) => i.imageType === "SIZE" && i.fileName).sort((x, y) => x.sortNo - y.sortNo);
  const fImgs = p.images.filter((i) => i.imageType === "FUNCTION" && i.fileName).sort((x, y) => x.sortNo - y.sortNo);
  const featureLines: string[] = [];
  if (choko)
    featureLines.push(
      `  <li><img src="/pl_img/products_detail/${choko[0]}" alt="この商品は下記タイプがあります。${choko[1]}" width="968" height="968" loading="lazy" /></li>`
    );
  for (const img of sizeImgs)
    featureLines.push(
      `  <li><img src="${IMG_BASE}/${folder}/${img.fileName}" alt="${alt} ${fAlt(img.fileName)} 機能説明画像${fmtNo(img.sortNo - 3)}" width="800" height="800" loading="lazy" /></li>`
    );
  for (const img of fImgs)
    featureLines.push(
      `  <li><img src="${IMG_BASE}/${folder}/${img.fileName}" alt="${alt} ${fAlt(img.fileName)} 機能説明画像${fmtNo(img.sortNo)}" width="800" height="800" loading="lazy" /></li>`
    );
  const images03 = featureLines.length
    ? `<div id="products_images03" class="products_img detail_block01">
<h3 class="ttl_line01">機能説明</h3>
<div class="products_img_slide">
<ul class="slide_box">
${featureLines.join("\n")}
</ul>
</div><!--//products_img_slide-->
</div><!--//products_images03-->`
    : "";

  const cart = `<div class="btn_block01 detail_block01">
  <p class="btn_gocart01"><a href="#product_cart_area"><span>ご注文はこちらから</span></a></p>
</div><!--//btn_block01-->`;

  let tail = cart;
  if (images01) tail += `\n\n\n\n${images01}`;
  if (images03) tail += images01 ? `\n\n\n${images03}` : `\n\n\n\n${images03}`;
  // 画像ブロックが無い場合はカート直後に空行が1行多い(現行出力)
  const body = other
    ? `${details}\n\n\n\n${tail}${images01 || images03 ? "\n\n" : "\n\n\n"}`
    : `${details}\n\n\n\n${tabBlock}\n\n\n\n${tail}${images01 || images03 ? "\n\n" : "\n\n\n"}`;
  return wrapPlus(6, body);
}

// ============== 独自コメント(7): SPECページリンク ==============
export function plComment07(p: ProductFull): string {
  const models = [...new Set(p.variations.filter((v) => v.listed).map((v) => v.modelNumber).filter(Boolean))];
  const body = `<div id="product_item_detail" class="detail_block01">
<ul>
  <li><a href="/spec/${p.productCode}.html" target="_blank">${models.join(" / ")} ${p.maker?.nameJp ?? ""}${isOtherSheet(p) ? `製${opCategoryOf(p)}` : "製ペンダントライト"} SPEC</a></li>
</ul>
</div><!--//product_item_detail-->
`;
  return wrapPlus(7, body);
}

// ============== 独自コメント(8): 関連商品 ==============
export function plComment08(p: ProductFull): string {
  const folder = imgFolder(p);
  // VBA準拠: 関連範囲(メーカーID+通番が同じ連続シート行)が1行だけならブロックなし。
  // マップには範囲が2行以上ある商品のみ、行レベル○かつ非販売終了で絞った表示リストが入る
  const related = relatedMap.get(p.productCode);
  if (!related || related.length === 0) return wrapPlus(8, ""); // 範囲1行 or 全て生産終了/非○
  const items = related
    .map((r) => {
      const self = r.productCode === p.productCode;
      const suffix = plAltSuffix(r);
      const imageName = plHasImageName(r) ? `${r.name} ` : "";
      const alt = `${imageName}${p.maker?.nameJp ?? ""}${suffix} メイン型番 ${self ? "メイン商品" : "関連商品"} メインイメージ01`;
      return `    <li${self ? ' class="on"' : ""}><a href="/c/${folder}/${r.productCode}"><img src="${IMG_BASE}/${folder}/${r.mainImage ?? ""}" alt="${alt}" width="340" height="340" loading="lazy" /><span>${r.installationType ?? ""}</span></a></li>`;
    })
    .join("\n");
  const body = `<div id="products_variation" class="detail_block01">

<div class="products_variation_inner">
<h3>この商品の関連商品</h3>
<p class="mb015">同デザインの色違いや取り付けタイプ違いの商品です。</p>
<div class="variation_box">
  <ul class="scroll_box">
${items}
  </ul>
</div><!--//variation_box-->
</div><!--//products_variation_inner-->

</div><!--//products_variation-->
`;
  return wrapPlus(8, body);
}

// ============== 独自コメント(9): 生産終了/入荷待ちバナー ==============
export function plComment09(p: ProductFull): string {
  let body = "";
  // VBA準拠: 代表バリエーション行(親行)の販売終了(E列○)で判定。代表行が無い場合のみステータスで代用
  const repVar = p.variations.find((v) => v.isRepresentative);
  const eos = repVar ? repVar.eosFlag : isDiscontinuedPl(p);
  if (eos) {
    body = `<div class="bnr_end01">
    <dl>
      <dt>こちらの商品は<span>メーカー生産終了品</span>となります。</dt>
      <dd>
        <p class="mb005">後継機種またはデザインや素材の近しい商品をご案内いたします。お気軽にお問い合わせください。</p>
${p.successorModel ? `        <p class="link01"><a href="/p/search?nostock=false&keyword=${p.successorModel}">後継機種（類似品）はこちら</a></p>\n` : ""}      </dd>
    </dl>
</div><!--//bnr_end01-->`;
  } else if (p.status === "BACKORDER" || p.status === "RESERVE") {
    const arrival = p.statusNote
      ? `\n        <p class="arrival">こちらの商品は<span>「${p.statusNote}」</span>の予定でございます。</p>`
      : "";
    body = `<div class="bnr_reserve01">
    <dl>
      <dt>こちらの商品は<span>メーカーからの入荷待ち商品</span>となります。</dt>
      <dd>
        <p class="mb005">入荷時期についてはご案内させていただきますので、お気軽にお問い合わせください。</p>${arrival}
      </dd>
    </dl>
</div><!--//bnr_reserve01-->`;
  }
  return wrapPlus(9, body);
}
