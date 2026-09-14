// futureshop 商品CSV(CF版)の独自コメント等のHTML生成
// 現行VBA(ceilingfan/modules/futureshop商品CSV.bas ほか)の出力を再現する。
// (13)(14)は画像実ファイルの縦横px(CheckImageInfo)が必要なため未実装(画像資産の取得後に対応)
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

const FS_CMS_ITEM_IMGPATH = "https://www.fazoo.biz/cf_item_img/";
const LAZY_SRC = "data:image/gif;base64,R0lGODlhAQABAGAAACH5BAEKAP8ALAAAAAABAAEAAAgEAP8FBAA7";

function cfExtra(p: ProductFull): Record<string, unknown> {
  return (p.extra ?? {}) as Record<string, unknown>;
}
function exs(p: ProductFull, key: string): string {
  const v = cfExtra(p)[key];
  return typeof v === "string" ? v : "";
}

// ================= メーカー名(Setメーカー名の各Case) =================
// キーはCFブックのメーカー記号(makers.maker_code)
// Case 2: 英語+(日本語)
const CF_MAKER_EN_JP: Record<string, string> = {
  I: "FAZOO(ファズー)", A: "AGLED(アグレッド)旧丸善電機(Lucky)", N: "NEC_LIGHTING(NECライティング)",
  O: "ODELIC(オーデリック)", R: "ORRB(オーブ)", K: "KOIZUMI(コイズミ)",
  W: "Life on Products(ライフオンプロダクツ)", D: "DAIKO(ダイコー)", Z: "タキズミ(瀧住電機工業)",
  L: "DULTON(ダルトン)", M: "TOKYOMETAL(東京メタル工業)", T: "TOSHIBA(東芝ライテック)",
  J: "NIHON DENKO(日本電興)", P: "Panasonic(パナソニック)", H: "HERMOSA(ハモサ)",
  PH: "Phiten(ファイテン)", MA: "mAntra(マントラ)", E: "MITSUBISHI ELECTRIC(三菱電機)",
  X: "BRID(ブリッド)", Y: "YOUWA(ユーワ)", IM: "MinkaAire(ミンカエアー)", "-": "その他",
};
// Case 11: FS用商品URL
const CF_MAKER_URL: Record<string, string> = {
  I: "//www.fazoo.biz/c/ivillage/", A: "//www.fazoo.biz/c/agled/", N: "//www.fazoo.biz/c/nec/",
  O: "//www.fazoo.biz/c/odelic/", R: "//www.fazoo.biz/c/orrb/", K: "//www.fazoo.biz/c/koizumi/",
  W: "//www.fazoo.biz/c/javalo-elf/", D: "//www.fazoo.biz/c/daiko/", Z: "//www.fazoo.biz/c/takizumi/",
  L: "//www.fazoo.biz/c/dulton/", M: "//www.fazoo.biz/c/tome/", T: "//www.fazoo.biz/c/toshiba/",
  J: "//www.fazoo.biz/c/nihon-denko/", P: "//www.fazoo.biz/c/panasonic/", H: "//www.fazoo.biz/c/hermosa/",
  PH: "//www.fazoo.biz/c/phiten/", MA: "//www.fazoo.biz/c/mantra/", E: "//www.fazoo.biz/c/mitsubishi/",
  X: "//www.fazoo.biz/c/brid/", Y: "//www.fazoo.biz/c/youwa/", IM: "//www.fazoo.biz/c/import/",
  EE: "//www.fazoo.biz/c/option/",
};
// Case 12: メーカーロゴ(ファイル名+altの一部が結合された現行の生値)
export const CF_MAKER_LOGO: Record<string, string> = {
  I: `ivillage_logo.png" alt="シーリングファンライト通販専門店ファズー fazoo`,
  A: `agled_logo.gif" alt="アグレッドのメーカーロゴ`, N: `nec_logo.gif" alt="NECのメーカーロゴ`,
  O: `odelic_logo.gif" alt="オーデリックのメーカーロゴ`, R: `orrb_logo.gif" alt="オーブのメーカーロゴ`,
  K: `koizumi_logo.gif" alt="コイズミのメーカーロゴ`, W: `lop_logo.gif" alt="ライフオンプロダクツのメーカーロゴ`,
  D: `daiko_logo.gif" alt="ダイコーのメーカーロゴ`, Z: `takizumi_logo.gif" alt="タキズミのメーカーロゴ`,
  L: `dulton_logo.gif" alt="DULTONのメーカーロゴ`, M: `tokyometal_logo.gif" alt="東京メタルのメーカーロゴ`,
  T: `toshiba_logo.gif" alt="東芝のメーカーロゴ`, J: `nihondenko_logo.gif" alt="日本電興のメーカーロゴ`,
  P: `panasonic_logo.gif" alt="パナソニックのメーカーロゴ`, H: `hermosa_logo.gif" alt="HERMOSAのメーカーロゴ`,
  PH: `phiten_logo.gif" alt="ファイテンのメーカーロゴ`, MA: `mantra_logo.gif" alt="マントラのメーカーロゴ`,
  E: `mitsubishi_logo.gif" alt="三菱電機のメーカーロゴ`, X: `mercros_logo.gif" alt="メルクロスのメーカーロゴ`,
  Y: `youwa_logo.gif" alt="ユーワのメーカーロゴ`, IM: `minka-aire_logo.gif" alt="Minka Aireのメーカーロゴ`,
};
// Case 15: ロゴのwidth/height属性
export const CF_MAKER_LOGO_WH: Record<string, string> = {
  I: `width="176" height="56"`, A: `width="136" height="30"`, N: `width="108" height="36"`,
  O: `width="150" height="36"`, R: `width="60" height="70"`, K: `width="216" height="36"`,
  W: `width="64" height="70"`, D: `width="136" height="36"`, Z: `width="208" height="36"`,
  L: `width="176" height="36"`, M: `width="256" height="36"`, T: `width="204" height="36"`,
  J: `width="358" height="36"`, P: `width="208" height="36"`, H: `width="154" height="36"`,
  PH: `width="208" height="36"`, MA: `width="160" height="48"`, E: `width="116" height="48"`,
  X: `width="104" height="36"`, Y: `width="150" height="36"`, IM: `width="148" height="48"`,
};

export function cfMakerCode(p: ProductFull): string {
  return p.maker?.makerCode ?? "";
}
// Setメーカー名(2): 英語+(日本語)。EEはシートのメーカー名セル
export function cfMakerEnJp(p: ProductFull): string {
  const code = cfMakerCode(p);
  if (code === "EE") return exs(p, "makerCellName");
  return CF_MAKER_EN_JP[code] ?? "";
}

// ================= 共通ヘルパー =================
// B_ライト有無: 型番_一体型 or 型番_ライト が入っているか
export function cfHasLight(p: ProductFull): boolean {
  if (p.modelNumber) return true;
  return p.setComponents.some((c) => c.role === "LIGHT" && c.componentModel);
}
// 商品登録優先度が△(オプション単体商品)か
export function cfIsSingleOption(p: ProductFull): boolean {
  return exs(p, "priority") === "△";
}
// 入荷予定の生値(即日発送/在庫切れ/即日切れ/入荷待ち/予約販売/生産終了/その他)
function cfArrival(p: ProductFull): string {
  return p.statusNote ?? "";
}

// ImgFileNameToFilePath: ファイル名の先頭(「_」「-」の手前)からメーカーフォルダ名
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
  const us = fileName.indexOf("_");
  const hy = fileName.indexOf("-");
  const c1 = us < 0 ? 100 : us;
  const c2 = hy < 0 ? 100 : hy;
  const cut = Math.min(c1, c2);
  const prefix = cut >= 100 ? fileName : fileName.slice(0, cut);
  return IMG_FOLDER_MAP[prefix] ?? "etc";
}

// CFの型番連結(Set型番連結 iClass=1)は routes/exports.ts の cfModelConcat を使用(循環回避のため引数で受ける)

// Set小型軽量傾斜等: 検索・タイトル用の特徴タグ("大風量 " のように後置スペース連結)
export function cfSizeTags(p: ProductFull): string {
  const f = p.fanAttrs;
  let out = "";
  // 大風量(風量70以上 or "large1")
  const rawVol = exs(p, "windVolumeRaw");
  const vol = f?.windVolume != null ? Number(f.windVolume) : NaN;
  if (!Number.isNaN(vol) && vol >= 70) out += "大風量 ";
  else if (rawVol === "large1") out += "大風量 ";
  // 傾斜対応
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
  // 薄型/小型/軽量(空セルはVBAのEmpty=0比較を踏襲)
  if ((p.heightMm ?? 0) <= 350 && cfHasLight(p)) out += "薄型 ";
  if ((p.widthMm ?? 0) < 900) out += "小型 ";
  if (Number(p.weightKg ?? 0) <= 7) out += "軽量 ";
  return out;
}

// 商品ページタイトル: 型番連結[,商品名] + 特徴タグ + メーカー英(日)製シーリングファン[ライト]
export function cfPageTitle(p: ProductFull, modelConcat: string): string {
  let out = modelConcat;
  if (p.summary) out += `,${p.summary}`;
  out += " ";
  const single = cfIsSingleOption(p);
  if (cfArrival(p) !== "生産終了" && !single) out += cfSizeTags(p);
  out += `${cfMakerEnJp(p)}製`;
  if (!single) {
    out += "シーリングファン";
    if (cfHasLight(p)) out += "ライト";
  } else {
    out += "シーリングファン オプション単体";
  }
  // 電動昇降機特別対応
  if (["OXO001", "OXO002", "OXO003", "OXO004", "OXO007", "PXO001", "PXO002"].includes(p.productCode)) {
    out = out.replace("オプション単体", "電動昇降機・装置");
  }
  return out;
}

const cfBanner = (dir: "↓↓" | "↑↑", n: number) =>
  `<!-- ---------------------------------------------\n ************${dir}独自コメント（${String(n).padStart(2, "0")}）${dir} ************\n--------------------------------------------- -->\n`;

// ================= Shipping_box: 納期・生産終了などのバナー =================
function cfShippingBox(p: ProductFull): string {
  const arrival = cfArrival(p);
  const arrivalText = exs(p, "arrivalText"); // 入荷待ち文言(7列)
  const identRaw = cfExtra(p)["identNo"];
  const ident = typeof identRaw === "number" ? identRaw : null;
  let out = "";
  const reserveComment = arrivalText
    ? `  <p class="reserve_comment">こちらの商品は、『<span>${arrivalText}</span>』でございます。</p>\n`
    : "";
  const reserveBanner = (cls: string, dt: string) =>
    `<div class="${cls} bnr_reserve_area free_block01">\n` +
    `  <div class="reserve_banner">\n` +
    `    <div class="reserve_banner_inner clearfix">\n` +
    `      <p class="reserve_img"><img class="lazyload" src="${LAZY_SRC}" data-src="https://www.fazoo.biz/common/img/icon_fan.png" alt="" width="74" height="74"></p>\n` +
    `      <dl>\n` +
    `        <dt>${dt}</dt>\n` +
    `        <dd>メーカーから入荷でき次第、商品を順次発送させていただきます。</dd>\n` +
    `      </dl>\n` +
    `    </div><!--//reserve_banner_inner-->\n` +
    `  </div><!--//reserve_banner-->\n` +
    reserveComment +
    `</div><!--//${cls.split(" ")[0]}-->\n`;
  if (arrival === "即日発送") {
    out +=
      `<div class="bnr_shipping free_block01">\n` +
      `  <dl class="clearfix">\n` +
      `    <dt class="bnr_shipping_box01">即日発送対応商品</dt>\n` +
      `    <dd class="bnr_shipping_box01"><span>こちらの商品は<em>15時まで</em>の</span><span>ご注文で<em>当日発送</em></span><br>月曜日から金曜日まで対応しています！</dd>\n` +
      `  </dl>\n` +
      `</div><!--//bnr_shipping-->\n`;
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
    const endImg = `    <p class="end_img"><img class="lazyload" src="${LAZY_SRC}" data-src="https://www.fazoo.biz/common/img/icon_end.png" alt="生産終了" width="61" height="61"></p>\n`;
    if (p.successorModel) {
      const url = `${CF_MAKER_URL[cfMakerCode(p)] ?? ""}${p.successorModel}`;
      out +=
        `<div class="bnr_end01 free_block01">\n` +
        `  <div class="end_banner clearfix">\n` +
        endImg +
        `    <dl>\n` +
        `      <dt>こちらの商品は<span>メーカー生産終了品</span>となります。</dt>\n` +
        `      <dd><p class="mb005">本商品の<span>最新モデル</span>がございます。お求めの方は下記をクリックしてください。</p>\n` +
        `      <p class="link01"><a href="${url}">最新モデルはこちら</a></p></dd>\n` +
        `    </dl>\n` +
        `  </div><!--//end_banner-->\n` +
        `</div><!--//bnr_end01-->\n`;
    } else {
      out +=
        `<div class="bnr_end01 free_block01">\n` +
        `  <div class="end_banner clearfix">\n` +
        endImg +
        `    <dl>\n` +
        `      <dt>こちらの商品は<span>メーカー生産終了品</span>となります。</dt>\n` +
        `      <dd>後継機種（類似品）をご案内させていただきますので、お気軽にお問い合わせください。</dd>\n` +
        `    </dl>\n` +
        `  </div><!--//end_banner-->\n` +
        `</div><!--//bnr_end01-->\n`;
    }
  }
  return out;
}

// ================= 独自コメント(11): 配送状況・オプション単体バナー =================
export function cfComment11(p: ProductFull): string {
  let body = "";
  if (cfIsSingleOption(p)) {
    body +=
      `<div class="bnr_option01 free_block01">\n` +
      `  <div class="option_banner">\n` +
      `    <dl>\n` +
      `      <dt><span>こちらはオプションの</span><span>単体商品となります。</span></dt>\n` +
      `      <dd>単独で使用することができませんのでご注意ください。</dd>\n` +
      `    </dl>\n` +
      `  </div><!--//option_banner-->\n` +
      `</div><!--//bnr_option01-->\n`;
  }
  body += cfShippingBox(p);
  return `${cfBanner("↓↓", 11)}${body}${cfBanner("↑↑", 11)}\n`;
}

// ================= 独自コメント(12): メインイメージ+サイズ概要 =================
// スライダー対象: 画像データM1..E1(メイン2+イメージ10+サイズ2+機能3+リモコン+付属品)のうち .jpg/.gif のみ
function cfSliderImages(p: ProductFull): { fileName: string }[] {
  const pick = (type: string) =>
    p.images.filter((i) => i.imageType === type && i.fileName).sort((a, b) => a.sortNo - b.sortNo);
  return [
    ...pick("MAIN"),
    ...pick("IMAGE"),
    ...pick("SIZE"),
    ...pick("FUNCTION"),
    ...pick("REMOTE"),
    ...pick("ACCESSORY"),
  ].filter((i) => /\.(jpg|gif)/i.test(i.fileName));
}

export function cfComment12(p: ProductFull, modelConcat: string): string {
  const alt = cfPageTitle(p, modelConcat);
  let main = "";
  let thumbs = "";
  for (const img of cfSliderImages(p)) {
    const folder = cfImgFolder(img.fileName);
    main += `  <div class="main_slide"><img class="lazyload" src="${LAZY_SRC}" data-src="${FS_CMS_ITEM_IMGPATH}${folder}/${img.fileName}" alt="${alt}" width="768" height="500"></div>\n`;
    thumbs += `  <div class="thm_slide"><img class="lazyload" src="${LAZY_SRC}" data-src="${FS_CMS_ITEM_IMGPATH}${folder}/${img.fileName}" alt="${alt}" width="100" height="100"></div>\n`;
  }
  let body =
    `<div id="product_slide_box" class="mainslide">\n` +
    main +
    `</div><!--//product_slide_box-->\n\n` +
    `<div class="product_thumbnail">\n` +
    thumbs +
    `</div><!--//product_thumbnail-->\n\n`;

  // サイズなど情報
  body += `<div id="pgtop_detail_area" class="free_block01">\n`;
  const isLift = ["OXO001", "OXO002", "OXO003", "OXO004", "OXO007", "PXO001", "PXO002"].includes(p.productCode);
  if (!isLift) {
    const f = p.fanAttrs;
    body += `<ul class="product_size">\n`;
    body += `  <li>幅：${p.widthMm ?? ""}mm</li>\n`;
    if (p.height2Mm != null && p.heightMm !== p.height2Mm) {
      body += `  <li>高さ：${p.heightMm ?? ""}-${p.height2Mm}mm</li>\n`;
    } else {
      body += `  <li>高さ：${p.heightMm ?? ""}mm</li>\n`;
    }
    if (f?.heightToBladeMm != null) body += `  <li>羽根上：約${f.heightToBladeMm}mm</li>\n`;
    else body += `  <li>羽根上：データなし</li>\n`;
    body += `  <li>重さ：${p.weightKg != null ? Number(p.weightKg) : ""}kg</li>\n`;
    const angled = f?.angledCeiling ?? "";
    if (angled && angled !== "NG") {
      body += angled.includes("-") ? `  <li>${angled}度</li>\n` : `  <li>0-${angled}度</li>\n`;
    } else {
      body += `  <li>傾斜不可</li>\n`;
    }
    const vol = f?.windVolume != null ? Number(f.windVolume) : null;
    if (vol != null && !Number.isNaN(vol)) body += `  <li>風量：${vol}m<sup>3</sup>/min</li>\n`;
    else body += `  <li>風量：データなし</li>\n`;
    const spd = f?.windSpeed != null ? Number(f.windSpeed) : null;
    if (spd != null && !Number.isNaN(spd)) {
      const fmt = Math.floor(spd * 10) === spd * 10 ? spd.toFixed(1) : spd.toFixed(2);
      body += `  <li>風速：${fmt}m/sec</li>\n`;
    } else {
      body += `  <li>風速：データなし</li>\n`;
    }
    if (f?.rotationSpeed != null) body += `  <li>回転数：${f.rotationSpeed}rpm</li>\n`;
    else body += `  <li>回転数：データなし</li>\n`;
    body += `</ul>\n`;
    // 組み合わせ商品(型番_一体型〜型番_オプションに2つ以上)
    const modelCells = [
      p.modelNumber,
      ...["FAN", "LIGHT", "PIPE", "FLANGE", "REMOTE", "BLADE", "OPTION"].map(
        (role) => p.setComponents.find((c) => c.role === role)?.componentModel
      ),
    ].filter(Boolean);
    if (modelCells.length > 1) {
      body +=
        `<div class="product_comment">\n` +
        `  <p>こちらのシーリングファンは上記の写真どおりのセット商品です。<br>\n` +
        `  取り付けの際に必要な部品は、すべて同梱されております。</p>\n` +
        `</div><!--//product_comment-->\n`;
    }
  }
  body += `</div><!--//pgtop_detail_area-->\n`;
  return `${cfBanner("↓↓", 12)}${body}${cfBanner("↑↑", 12)}\n`;
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
    body = `<div class="price-down">\n<span>${off}% OFF</span>\n</div>\n`;
  }
  return `${cfBanner("↓↓", 15)}${body}${cfBanner("↑↑", 15)}\n`;
}

// ================= 独自コメント(16): カート付近のバナー文言 =================
export function cfComment16(p: ProductFull): string {
  let body = "";
  if (exs(p, "moneyBack90") === "なし") {
    body +=
      `<div class="product_parts01">\n` +
      `   <div class="comment01">\n` +
      `       <p><span>こちらの商品は</span><span><em>90日間返金保証対象外</em></span><span>です</span></p>\n` +
      `   </div>\n` +
      `</div>\n`;
  }
  const sub2 = (p.descriptions as { label: string; body: string }[] | null)?.find(
    (d) => d.label === "サブ紹介文2"
  )?.body;
  if (sub2) {
    body += `<div class="product_parts01">\n  ${sub2}\n</div>\n`;
  }
  return `${cfBanner("↓↓", 16)}${body}${cfBanner("↑↑", 16)}\n`;
}

// ================= 独自コメント(14): カート下(在庫バナー・5つの安心・取付方法・動画・商品詳細) =================
export function cfComment14(p: ProductFull, modelConcat: string): string {
  let body = "";
  const shipping = cfShippingBox(p);
  body += shipping;
  const isImport = cfMakerCode(p) === "IM";
  if (isImport) {
    body +=
      `<div class="overseas_block01 free_block01">\n` +
      `  <p>※海外製品は個人輸入での購入となります。<br>\n` +
      `海外製シーリングファンは90日間返金保証、3年保証の対象外となります。<br>\n` +
      `お届けには1週間程度お時間が掛かる場合がございますので、お急ぎの場合はお気軽にお問い合わせください。<br>\n` +
      `表示価格で購入頂けますが、為替レートや送料高騰などにより表示価格が変動する場合がございます。</p>\n` +
      `</div><!--//overseas_block01-->\n\n`;
  } else if (shipping === "") {
    body +=
      `<div class="bnr_zaiko01 free_block01">\n` +
      `  <div class="zaiko_banner">\n` +
      `    <dl>\n` +
      `      <dt>在庫がある場合、午前中までのご注文で翌営業日中に発送致します。</dt>\n` +
      `      <dd>※事前に在庫を確認する場合は、メールまたはお電話にてお問い合わせください。</dd>\n` +
      `    </dl>\n` +
      `  </div><!--//zaiko_banner-->\n` +
      `</div><!--//bnr_zaiko01-->\n\n`;
  }

  // ファズーの5つの安心
  const li = (cls: string, file: string, alt: string) =>
    `  <li${cls ? ` class="${cls}"` : ""}><img class="lazyload" src="${LAZY_SRC}" data-src="https://www.fazoo.biz/cf_img/products_detail/${file}" alt="${alt}" width="144" height="116"></li>\n`;
  if (isImport || cfIsSingleOption(p)) {
    body += `<div id="fazoo_reliefs_block01" class="free_block01 reliefs_block03">\n`;
    body += `<h3><span>ファズーの<em>５つ</em>の<em>安心</em></span></h3>\n<div id="fazoo_reliefs_inner">\n<ul class="clearfix">\n`;
    body += li("reliefs_no", "reliefs01_no.png", "購入後90日間返金保証");
    body += li("reliefs_no", "reliefs02_no.png", "無料3年保証");
  } else if (exs(p, "moneyBack90") === "なし") {
    body += `<div id="fazoo_reliefs_block01" class="free_block01 reliefs_block02">\n`;
    body += `<h3><span>ファズーの<em>５つ</em>の<em>安心</em></span></h3>\n<div id="fazoo_reliefs_inner">\n<ul class="clearfix">\n`;
    body += li("reliefs_no", "reliefs01_no.png", "購入後90日間返金保証");
    body += li("", "reliefs02.png", "無料3年保証");
  } else {
    body += `<div id="fazoo_reliefs_block01" class="free_block01">\n`;
    body += `<h3><span>ファズーの<em>５つ</em>の<em>安心</em></span></h3>\n<div id="fazoo_reliefs_inner">\n<ul class="clearfix">\n`;
    body += li("", "reliefs01.png", "購入後90日間返金保証");
    body += li("", "reliefs02.png", "無料3年保証");
  }
  body += li("", "reliefs03.png", "10000円以上送料無慮");
  body += li("", "reliefs04.png", "多彩な決済方法");
  body += li("", "reliefs05.png", "取付工事も安心の全国対応");
  body +=
    `</ul>\n` +
    `<p class="reliefs_txt"><span>商品や取り付けでわからないことは、</span><span>お電話でも丁寧にお答えします。</span></p>\n` +
    `<dl class="clearfix">\n` +
    `  <dt class="dial_box01">お客様ご相談ダイヤル</dt>\n` +
    `  <dd class="dial_box01"><span class="day01">月～金　9時～18時</span><span class="reliefs_call">\n` +
    `    <a href="tel:0466-47-9490" onclick="gtag('event', 'sp_tap', {'event_category': 'tel','event_label': 'contact'});">0466-47-9490</a></span></dd>\n` +
    `</dl>\n` +
    `</div><!--//fazoo_reliefs_inner-->\n` +
    `</div><!--//fazoo_reliefs_block01-->\n\n`;

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
    `  <dd><img class="lazyload" src="${LAZY_SRC}" data-src="https://www.fazoo.biz/cf_img/products_detail/${file}" alt="${alt}" width="${w}" height="${h}"></dd>\n`;
  const boltImg = (file: string, h: number) =>
    `  <dd class="inst_bolt"><img class="lazyload" src="${LAZY_SRC}" data-src="https://www.fazoo.biz/cf_img/products_detail/${file}" alt="ネジ" width="24" height="${h}"></dd>\n`;
  if (!subIndividual && !cfIsSingleOption(p)) {
    if (t1 === "○") {
      body +=
        `<div id="installation_block04" class="installation_block free_block01">\n` +
        `<h3><span>ご購入の前に必ずご確認ください</span></h3>\n` +
        `<div class="installation_inner clearfix">\n` +
        `<p class="inst_txt"><span>こちらの商品は<em>簡易取付タイプ</em>となり、</span><span>電気工事が<em>不要</em>です。</span><br>\n` +
        `下記の配線器具に、ご自身で取り付けることが可能です。</p>\n\n` +
        `<dl class="inst_box01 color02">\n  <dt>木ネジで固定する必要なし</dt>\n` +
        instImg("installation_04-01.png", "引掛埋込ローゼット フル引掛ローゼット") +
        `</dl>\n<dl class="inst_box01 color02">\n  <dt>天井に木ネジ固定する必要あり</dt>\n` +
        instImg("installation_04-02.png", "角型引掛シーリング 丸形フル引掛シーリング") +
        `</dl>\n<ul class="inst_li01">\n` +
        `  <li>簡易取付タイプでも、組み立てや取り付けなど1人では難しい場合がございます。</li>\n` +
        `  <li>壁スイッチに調光機能があるものや、壁スイッチ自体がない場合はお取り付けができません。</li>\n` +
        `  <li>戸建てや木造の建物へのお取り付けは、必ず天井裏の木材（野縁）に木ネジ4本で、付属のアタッチメントをしっかりと固定してください。</li>\n` +
        `  <li>上記以外の配線器具については、取り付けができない可能性がございますのでお問い合わせください。</li>\n` +
        `</ul>\n</div><!--//installation_inner-->\n</div><!--//installation_block04-->\n\n`;
    } else if (t1 === "hanwa_installation_05") {
      body +=
        `<div id="installation_block05" class="installation_block free_block01">\n` +
        `<h3><span>ご購入の前に必ずご確認ください</span></h3>\n` +
        `<div class="installation_inner clearfix">\n` +
        `<p class="inst_txt"><span>こちらの商品は<em>簡易取付タイプ</em>となり、</span><span>電気工事が<em>不要</em>です。</span><br>\n` +
        `下記の配線器具に、ご自身で取り付けることが可能です。</p>\n\n` +
        `<dl class="inst_box01 color02">\n  <dt>ローゼット用ネジ4個で設置</dt>\n` +
        instImg("installation_05-01.png", "引掛露出ローゼット フル引掛ローゼット") +
        boltImg("installation_bolt01.png", 34) +
        `</dl>\n<dl class="inst_box01 color02">\n  <dt>ローゼット用ネジ2個で設置可</dt>\n` +
        instImg("installation_05-02.png", "引掛埋込ローゼット 引掛露出ローゼット") +
        boltImg("installation_bolt01.png", 34) +
        `</dl>\n<dl class="inst_box01 color02">\n  <dt>木ネジでは固定する必要なし</dt>\n` +
        instImg("installation_05-03.png", "引掛露出ローゼット フル引掛ローゼット") +
        boltImg("installation_bolt01.png", 34) +
        `</dl>\n<dl class="inst_box01 color02">\n  <dt>天井に木ネジ固定する必要あり</dt>\n` +
        instImg("installation_05-04.png", "角型引掛シーリング 丸形フル引掛シーリング") +
        boltImg("installation_bolt02.png", 66) +
        `</dl>\n<ul class="inst_li01">\n` +
        `  <li>簡易取付タイプでも、組み立て取り付けなど1人では難しい場合がございます。</li>\n` +
        `  <li>壁スイッチに調光機能があるものや、壁スイッチ自体がない場合はお取り付けができません。</li>\n` +
        `  <li>戸建てや木造の建物へのお取り付けは、必ず天井裏の木材（野縁）に木ネジ4本で、付属のアタッチメントをしっかりと固定してください。</li>\n` +
        `  <li>上記以外の配線器具については、取り付けができない可能性がございますので、お問い合わせください。</li>\n` +
        `</ul>\n</div><!--//installation_inner-->\n</div><!--//installation_block05-->\n\n`;
    } else if (t1 === "phiten_installation_01") {
      body +=
        `<div id="installation_block04" class="installation_block free_block01">\n` +
        `<h3><span>ご購入の前に必ずご確認ください</span></h3>\n` +
        `<div class="installation_inner clearfix">\n` +
        `<p class="inst_txt"><span>こちらの商品は<em>簡易取付タイプ</em>となり、</span><span>電気工事が<em>不要</em>です。</span><br>\n` +
        `下記の配線器具に、ご自身で取り付けることが可能です。</p>\n\n` +
        `<dl class="inst_box01 color02">\n  <dt>ローゼットも<span class="f_red t-bolder">天井に木ネジ固定</span>する必要あり</dt>\n` +
        instImg("installation_04-01.png", "引掛埋込ローゼット フル引掛ローゼット") +
        `</dl>\n<dl class="inst_box01 color02">\n  <dt>天井に木ネジ固定する必要あり</dt>\n` +
        instImg("installation_04-02.png", "角型引掛シーリング 丸形フル引掛シーリング") +
        `</dl>\n<ul class="inst_li01">\n` +
        `  <li>簡易取付タイプでも、組み立てや取り付けなど1人では難しい場合がございます。</li>\n` +
        `  <li>壁スイッチに調光機能があるものや、壁スイッチ自体がない場合はお取り付けができません。</li>\n` +
        `  <li>戸建てや木造の建物へのお取り付けは、必ず天井裏の木材（野縁）に木ネジ4本で、付属のアタッチメントをしっかりと固定してください。</li>\n` +
        `  <li>上記以外の配線器具については、取り付けができない可能性がございますのでお問い合わせください。</li>\n` +
        `</ul>\n</div><!--//installation_inner-->\n</div><!--//installation_block04-->\n\n`;
    } else if (t2 === "○") {
      body +=
        `<div id="installation_block02" class="installation_block free_block01">\n` +
        `<h3><span>ご購入の前に必ずご確認ください</span></h3>\n` +
        `<div class="installation_inner clearfix">\n` +
        `<p class="inst_txt">こちらの商品はローゼットの種類によっては<em>電気工事</em>が必要となります。<br>ご購入の際にはご注意ください！</p>\n\n` +
        `<dl class="inst_box01">\n  <dt>ローゼットを外すため電気工事が必要</dt>\n` +
        instImg("installation_02-01.png", "引掛埋込ローゼット フル引掛ローゼット") +
        `</dl>\n<dl class="inst_box01 color02">\n  <dt>電気工事不要 天井に木ネジ固定必要</dt>\n` +
        instImg("installation_02-02.png", "角型引掛シーリング 丸形フル引掛シーリング") +
        `</dl>\n<ul class="inst_li01">\n` +
        `  <li>簡易取付タイプでも、組み立てや取り付けなど1人では難しい場合がございます。</li>\n` +
        `  <li>壁スイッチに調光機能があるものや、壁スイッチ自体がない場合はお取り付けができません。</li>\n` +
        `  <li>戸建てや木造の建物へのお取り付けは、必ず天井裏の木材（野縁）に木ネジ4本で、付属のアタッチメントをしっかりと固定してください。</li>\n` +
        `</ul>\n</div><!--//installation_inner-->\n</div><!--//installation_block02-->\n\n`;
    } else if (t3 === "○") {
      body +=
        `<div id="installation_block03" class="installation_block free_block01">\n` +
        `<h3><span>ご購入の前に必ずご確認ください</span></h3>\n` +
        `<div class="installation_inner clearfix">\n` +
        `<p class="inst_txt"><span>こちらの商品は<em>簡易取付タイプ</em>となり、</span><span>電気工事が<em>不要</em>です。</span><br>\n` +
        `下記の配線器具に、ご自身で取り付けることが可能です。</p>\n\n` +
        `<dl class="inst_box01 color02">\n  <dt>木ネジで固定する必要なし</dt>\n` +
        instImg("installation_03-01.png", "引掛埋込ローゼット") +
        `</dl>\n<dl class="inst_box01 color02">\n  <dt>天井に木ネジ固定する必要あり</dt>\n` +
        instImg("installation_03-02.png", "角型引掛シーリング 丸形フル引掛シーリング") +
        `</dl>\n<dl class="inst_box02 clear_b">\n  <dt>ネジ位置によっては取り付けが出来ない場合あり<span class="f_size80"> ※詳細はお問い合わせください</span></dt>\n` +
        instImg("installation_03-03.png", "引掛露出ローゼット フル引掛ローゼット") +
        `</dl>\n\n<ul class="inst_li01">\n` +
        `  <li>簡易取付タイプでも、組み立てや取り付けなど1人では難しい場合がございます。</li>\n` +
        `  <li>壁スイッチに調光機能があるものや、壁スイッチ自体がない場合はお取り付けができません。</li>\n` +
        `  <li>戸建てや木造の建物へのお取り付けは、必ず天井裏の木材（野縁）に木ネジ4本で、付属のアタッチメントをしっかりと固定してください。</li>\n` +
        `  <li>上記以外の配線器具については、取り付けができない可能性がございますのでお問い合わせください。</li>\n` +
        `</ul>\n</div><!--//installation_inner-->\n</div><!--//installation_block03-->\n\n`;
    } else if (t4 === "panasonic_installation_01") {
      body +=
        `<div id="installation_block06" class="installation_block free_block01">\n` +
        `<h3><span>ご購入の前に必ずご確認ください</span></h3>\n` +
        `<div class="installation_inner">\n` +
        `<p class="inst_txt"><span>こちらの商品は取り付けに電気工事が</span><span><em>必要</em>となります。</span><br>\n` +
        `<span>また、下記ローゼットタイプの配線器具には</span><span>取り付けできません。</span><br>\n` +
        `<span>ご購入の際はご注意ください！</span></p>\n` +
        `\n` +
        `<dl class="inst_box03 color02">\n  <dt>ローゼットタイプ取り付け不可</dt>\n` +
        instImg("installation_06-01.png", "引掛埋込ローゼット フル引掛ローゼット") +
        `</dl>\n` +
        `\n` +
        `<div class="inst_comment">\n` +
        `  <p>当店ファズーが提携する全国の電気工事店をご紹介できますので、<br>ご依頼の際は下記までお気軽にお問い合わせください。</p>\n` +
        `  <div class="inst_inquiry">\n` +
        `    <p class="inst_shop"><span>シーリングファン・ライト専門店</span> <span>ファズー</span></p>\n` +
        `    <p class="inst_call"><span><a href="tel:0466-47-9490">0466-47-9490</a></span></p>\n` +
        `    <p class="f_size90">月～金 9時～18時（土日祝除く）</p>\n` +
        `  </div>\n</div>\n</div><!--//installation_inner-->\n</div><!--//installation_block06-->\n\n`;
    } else if (t4 === "○" || t5 === "○") {
      body +=
        `<div id="installation_block01" class="installation_block free_block01">\n` +
        `<h3><span>ご購入の前に必ずご確認ください</span></h3>\n` +
        `<div class="installation_inner">\n` +
        `<p class="inst_txt"><span>こちらの商品は取り付けに電気工事が</span><span><em>必要</em>となります。</span><br><span>ご購入の際はご注意ください！</span></p>\n` +
        `<div class="inst_comment">\n` +
        `  <p>当店ファズーが提携する全国の電気工事店をご紹介できますので、<br>ご依頼の際は下記までお気軽にお問い合わせください。</p>\n` +
        `  <div class="inst_inquiry">\n` +
        `    <p class="inst_shop"><span>シーリングファン・ライト専門店</span> <span>ファズー</span></p>\n` +
        `    <p class="inst_call"><span><a href="tel:0466-47-9490" onclick="gtag('event', 'sp_tap', {'event_category': 'tel','event_label': 'contact'});">0466-47-9490</a></span></p>\n` +
        `    <p class="f_size90">月～金 9時～18時（土日祝除く）</p>\n` +
        `  </div>\n</div>\n</div><!--//installation_inner-->\n</div><!--//installation_block01-->\n\n`;
    }
  }

  // 取付動画
  const video = p.fanAttrs?.installVideoType ?? "";
  const movieBox = (dt: string, pTxt: string, yt: string) =>
    `<dl class="movie_box01">\n  <dt>${dt}</dt>\n  <dd>\n    <p>${pTxt}</p>\n    <div><iframe src="https://www.youtube-nocookie.com/embed/${yt}?rel=0&amp;showinfo=0" frameborder="0" allowfullscreen></iframe></div>\n  </dd>\n</dl>\n`;
  if (video === "スタンダード") {
    body +=
      `<div id="movie_block01" class="movie_block free_block01 clearfix">\n` +
      `<h3 class="ttl_line01">シーリングファンのベース金具 アタッチメント取り付け 説明動画（30秒）</h3>\n\n` +
      movieBox("マンションなど鉄筋コンクリート造の場合", "（ローゼットへの固定）", "QqcZPusMWjA") + "\n" +
      movieBox("戸建やアパートなど木造の場合", "（木ネジを使用しての固定）", "5mm9HLuJkn0") +
      `</div><!--//movie_block01-->\n\n`;
  } else if (video === "Panaローゼット2本ネジ") {
    body +=
      `<div id="movie_block02" class="movie_block free_block01 clearfix">\n` +
      `<h3 class="ttl_line01">シーリングファンのベース金具アタッチメント取り付け 説明動画（38秒、30秒）</h3>\n\n` +
      movieBox("マンションなど鉄筋コンクリート造の場合", "（ローゼットへの固定）", "UA646BNNo38") + "\n" +
      movieBox("戸建やアパートなど木造の場合", "（木ネジを使用しての固定）", "5mm9HLuJkn0") +
      `</div><!--//movie_block02-->\n\n`;
  } else if (video === "マンションのみ電気工事" || video === "電気工事") {
    body +=
      `<div id="movie_block03" class="movie_block free_block01 clearfix">\n` +
      `<h3 class="ttl_line01">シーリングファンのベース金具アタッチメント取り付け 説明動画（43秒）</h3>\n\n` +
      movieBox("電気工事タイプを木ネジを使用して設置", "（電気工事士の資格が必要です）", "C-_YYKYHAJk") +
      `</div><!--//movie_block03-->\n\n`;
  } else if (video === "koizumiローゼット2本ネジ") {
    body +=
      `<div id="movie_block04" class="movie_block free_block01 clearfix">\n` +
      `<h3 class="ttl_line01">シーリングファンのベース金具アタッチメント取り付け 説明動画（30秒）</h3>\n\n` +
      movieBox("マンションなど鉄筋コンクリート造の場合", "（ローゼットへの固定）", "VWuNEWO9srQ") + "\n" +
      movieBox("戸建やアパートなど木造の場合", "（木ネジを使用しての固定）", "5mm9HLuJkn0") +
      `</div><!--//movie_block04-->\n\n`;
  }

  // 商品詳細について(サブ紹介文1 + 隠しページリンク)
  const sub1 = p.detail ?? "";
  const aLinkWord = `${cfMakerEnJp(p)} ${modelConcat}`;
  const specLink = cfHasLight(p)
    ? `${aLinkWord} シーリングファンライトSPEC`
    : `${aLinkWord} シーリングファンSPEC`;
  body +=
    `<div id="item_detail_block01" class="free_block01">\n` +
    `<h3 class="ttl_line01">商品詳細について</h3>\n\n` +
    `${sub1}\n\n` +
    `<ul id="product_item_detail">\n` +
    `  <li><a href="https://www.fazoo.biz/original/${p.productCode}.html" target="_blank"><span style="font-size: 90%;">${modelConcat} IMAGE</span></a></li>\n` +
    `  <li><a href="https://www.fazoo.biz/spec/${p.productCode}.html" target="_blank"><span style="font-size: 90%;">${specLink}</span></a></li>\n` +
    `</ul>\n` +
    `</div><!--//item_detail_block01-->\n`;
  return `${cfBanner("↓↓", 14)}${body}${cfBanner("↑↑", 14)}\n`;
}
