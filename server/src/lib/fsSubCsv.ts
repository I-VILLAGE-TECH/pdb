// futureshop サブCSV(PL: オプション基本/選択肢・バリエーション選択肢登録/詳細/在庫/価格・グループひもづけ)の生成
// 現行VBA(pendantlight/modules/futureshopOption.bas / futureshopVariation.bas / futureshopCategory.bas)の出力を再現する。
// - オプション2種: 複数行(親+子)の商品のみ対象。親は0円、子は親との税込価格差
// - バリエーション4種: ○行(listed)ごとに1行。選択肢文言は「n. 電球種類2+電球の種類[／電球色]」
// - グループひもづけ: 1商品(○行あり)につきカテゴリ数分の行。スタイル/素材/形/取付/テーブルサイズから生成
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
type Variation = ProductFull["variations"][number];

export const FS_SUB_FILE_TYPES = [
  "option_basic",
  "option_select",
  "variation_choice_new",
  "variation_choice_update",
  "variation_detail",
  "variation_stock",
  "variation_price",
  "category",
] as const;
export type FsSubFileType = (typeof FS_SUB_FILE_TYPES)[number];

// 現行のファイル名(タイムスタンプ部を除く)
export const FS_SUB_FILE_NAMES: Record<FsSubFileType, string> = {
  option_basic: "PL_FSオプション基本",
  option_select: "PL_FSオプション選択肢",
  variation_choice_new: "PL_FSバリエーション選択肢登録_new",
  variation_choice_update: "PL_FSバリエーション選択肢登録_update",
  variation_detail: "PL_FSバリエーション詳細登録",
  variation_stock: "PL_FSバリエーション在庫",
  variation_price: "PL_FSバリエーション価格",
  category: "PL_FSグループひもづけ",
};

// 分割件数(現行VBAのSPLIT_DATA_*)。超過時は _1.._N に分割し各ファイルにヘッダー行を付ける
export const FS_SUB_SPLIT_ROWS: Record<FsSubFileType, number> = {
  option_basic: 999,
  option_select: 999,
  variation_choice_new: 999,
  variation_choice_update: 999,
  variation_detail: 999,
  variation_stock: 999,
  variation_price: 999,
  category: 5000, // SPLIT_DATA_CATEGORY
};

const HEADERS: Record<FsSubFileType, string[]> = {
  option_basic: [
    "コントロールカラム", "商品URLコード", "項目名【基本情報】", "表示タイプ【基本情報】",
    "前改行【基本情報】", "項目名の位置【基本情報】", "表示【基本情報】",
    "説明文（PC）HTMLタグを使用する【説明文挿入】", "説明文（PC）【説明文挿入】",
    "説明文表示位置（PC）【説明文挿入】", "説明文（モバイル）HTMLタグを使用する【説明文挿入】",
    "説明文（モバイル）全角英数字カナを半角にする【説明文挿入】", "説明文（モバイル）【説明文挿入】",
    "説明文表示位置（モバイル）【説明文挿入】", "表示順", "最終更新日時",
  ],
  option_select: [
    "コントロールカラム", "商品URLコード", "項目名【基本情報】", "表示タイプ【基本情報】",
    "選択肢コード【選択肢・価格設定／価格設定】", "選択肢【選択肢・価格設定】",
    "価格【選択肢・価格設定】", "表示順【選択肢・価格設定】", "価格【価格設定】",
    "PC横幅（size）【価格設定】", "モバイル横幅（size）【価格設定】", "最終更新日時",
  ],
  variation_choice_new: [
    "コントロールカラム", "商品URLコード", "バリエーション別選択肢（横軸）", "バリエーション別枝番（横軸）",
    "バリエーション別選択肢（縦軸）", "バリエーション別枝番（縦軸）", "表示順", "商品番号", "商品名", "最終更新日時",
  ],
  variation_choice_update: [
    "コントロールカラム", "商品URLコード", "バリエーション別選択肢（横軸）", "バリエーション別枝番（横軸）",
    "バリエーション別選択肢（縦軸）", "バリエーション別枝番（縦軸）", "表示順", "商品番号", "商品名", "最終更新日時",
  ],
  variation_detail: [
    "商品URLコード", "バリエーション別選択肢（横軸）", "バリエーション別枝番（横軸）",
    "バリエーション別選択肢（縦軸）", "バリエーション別枝番（縦軸）", "代表バリエーション",
    "在庫閾値", "在庫切れメール閾値", "商品番号", "商品管理番号", "商品名", "JANコード", "最終更新日付",
  ],
  variation_stock: [
    "商品URLコード", "バリエーション別選択肢（横軸）", "バリエーション別枝番（横軸）",
    "バリエーション別選択肢（縦軸）", "バリエーション別枝番（縦軸）", "現在在庫数", "調整在庫数",
    "商品番号", "商品管理番号", "商品名", "JANコード", "最終更新日付",
  ],
  variation_price: [
    "商品URLコード", "バリエーション別選択肢（横軸）", "バリエーション別枝番（横軸）",
    "バリエーション別選択肢（縦軸）", "バリエーション別枝番（縦軸）", "バリエーション販売価格",
    "商品番号", "商品管理番号", "商品名", "JANコード", "最終更新日付",
  ],
  // 現行のFS_categoryシート(6列)。値が入るのはコントロールカラム/商品URLコード/表示先グループのみ
  category: ["コントロールカラム", "商品URLコード", "商品名", "表示先グループ", "登録日時", "最終更新日時"],
};

// ---------- グループひもづけ(カテゴリ) ----------

// 現行のCategoryName(): シート上の短縮語→FSの正式グループ名
const CATEGORY_NAME: Record<string, string> = {
  アンティーク: "アンティーク・レトロ",
  ガラス: "ガラス・ステンドグラス シェード",
  金属: "金属・真鍮・ホーロー シェード",
  木製: "木製・木目調 シェード",
  陶器: "陶器・磁器 シェード",
  布: "布・ナイロン シェード",
  紙: "紙・和紙 シェード",
  アクリル: "アクリル・樹脂 シェード",
  その他素材: "その他素材 シェード",
  丸: "丸・球",
  三角: "三角形",
};
function categoryName(s: string): string {
  return CATEGORY_NAME[s] ?? s;
}

const ITEM_TYPE_CATEGORY: Record<string, string> = {
  PENDANT_LIGHT: "ペンダントライト",
  CEILING_LIGHT: "シーリングライト",
  CEILING_FAN: "シーリングファン",
};

function plTag(p: ProductFull, key: string): string {
  const tags = p.lightingAttrs?.tags as Record<string, unknown> | null | undefined;
  const v = tags?.[key];
  return v == null ? "" : String(v);
}

// 現行のSetCategoryMngFS(SET_CATEGORY)。ペンダントライト一覧シートの商品を対象に、階層は「/」区切り
export function plFsCategories(p: ProductFull): string[] {
  const a = p.lightingAttrs;
  const cats: string[] = [];
  // 取付タイプ: ダクトレール(D)はスタイル/素材カテゴリに接頭辞
  const inst = (a?.installationCode ?? p.genreCode) === "D" ? "ダクトレール取付タイプ/" : "";
  // PL / CL / CF
  const typeCat = ITEM_TYPE_CATEGORY[p.category];
  if (typeCat) cats.push(typeCat);
  // スタイル
  for (const key of ["style1", "style2"]) {
    const v = plTag(p, key);
    if (v) cats.push(inst + categoryName(v));
  }
  // 素材(タイプ素材1/2)。2種が異なれば異素材ミックス
  const m1 = plTag(p, "material1");
  const m2 = plTag(p, "material2");
  if (m1) cats.push(inst + categoryName(m1));
  if (m2) cats.push(inst + categoryName(m2));
  if (m1 && m2 && m1 !== m2) cats.push(inst + "異素材ミックス シェード");
  // かたち(接頭辞なし)
  const shape = plTag(p, "shape");
  if (shape) cats.push(categoryName(shape));
  // タイプ別
  if (a?.highCeiling) cats.push("吹き抜け・高所天井用");
  if (a?.inclinedCeiling) cats.push("傾斜天井用");
  // テーブルサイズ別(W相当)。4人掛けは複数所属あり(40Wは2灯/3灯の両方)、6人掛けは1つ
  const tableRaw = a?.wattEquivalentTable ?? "";
  if (tableRaw !== "") {
    const w = Number(tableRaw);
    if (!Number.isFinite(w) || w < 1 || w > 100) {
      throw Object.assign(
        new Error(`${p.productCode}: テーブルサイズ別用(W相当)の値が正しくありません: ${tableRaw}`),
        { status: 400 }
      );
    }
    if (w >= 80 && w <= 100) cats.push("4人掛けテーブル用/1灯80W-100Wタイプ");
    if (w >= 40 && w <= 79) cats.push("4人掛けテーブル用/2灯40W-60Wタイプ");
    if (w >= 1 && w <= 40) cats.push("4人掛けテーブル用/3灯40Wタイプ");
    if (w >= 80 && w <= 100) cats.push("6人掛けテーブル用/2灯80W-100Wタイプ");
    else if (w >= 41 && w <= 79) cats.push("6人掛けテーブル用/3灯60Wタイプ");
    else if (w >= 1 && w <= 40) cats.push("6人掛けテーブル用/4灯40Wタイプ");
    else {
      throw Object.assign(
        new Error(`${p.productCode}: テーブルサイズ別用(W相当)の値が正しくありません: ${tableRaw}`),
        { status: 400 }
      );
    }
  }
  return cats;
}

export function fsSubCsvHeader(fileType: FsSubFileType): string[] {
  return HEADERS[fileType];
}

// 行の電球種別ラベル部(電球種類2 + 電球の種類)。専用カラム未取込データはoptionValueで代用
function rowBulbLabel(v: Variation): string {
  if (v.bulbKind2 != null || v.bulbType != null) return `${v.bulbKind2 ?? ""}${v.bulbType ?? ""}`;
  return v.optionValue ?? "";
}
// 選択肢文言: 「n. 電球種類2+電球の種類[／電球色]」(nは商品内の○行での位置)
function choiceLabel(n: number, v: Variation): string {
  let s = `${n}. ${rowBulbLabel(v)}`;
  if (v.bulbColor) s += `／${v.bulbColor}`;
  return s;
}
// V枝番: Format(枝番, "V00")
function vNo(v: Variation): string {
  return `V${String(v.variationNo).padStart(2, "0")}`;
}
// FS_OptionCodeReplace: 選択肢コードのNG文字置換
export function fsOptionCodeReplace(src: string): string {
  return src
    .replace(/ /g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "-")
    .replace(/　/g, "")
    .replace(/＋/g, "-")
    .replace(/／/g, "-")
    .replace(/#/g, "")
    .replace(/\(/g, "_")
    .replace(/\)/g, "");
}

// 商品の○行(listed)を枝番順に。ラベル番号は○行内の位置(EOS行も含めて数える)
function listedVars(p: ProductFull): Variation[] {
  return p.variations.filter((v) => v.listed).sort((a, b) => a.variationNo - b.variationNo);
}
function repVar(p: ProductFull): Variation | undefined {
  return p.variations.find((v) => v.isRepresentative) ?? p.variations[0];
}

// productName: FS商品名(exports.tsのfs_product_name)を注入(循環import回避)
export function generateFsSubCsv(
  fileType: FsSubFileType,
  products: ProductFull[],
  productName: (p: ProductFull) => string
): string[][] {
  const rows: string[][] = [];
  for (const p of products) {
    const vars = listedVars(p);
    if (vars.length === 0) continue;
    const rep = repVar(p);

    switch (fileType) {
      case "option_basic": {
        // 複数行(親+子)の商品のみ。1商品1行
        if (p.variations.length <= 1) break;
        rows.push([
          "u", p.productCode, "電球", "s", "0", "0", "0", "0",
          `<a href="#light_explanation">電球（あかり）の種類を確認する</a>`,
          "1", "0", "1", "", "1", "1", "",
        ]);
        break;
      }
      case "option_select": {
        // 複数行の商品のみ。親(代表)0円 → 子は親との税込価格差。生産終了の子はd行
        if (p.variations.length <= 1) break;
        if (!rep) break;
        const basePrice = rep.price ?? 0;
        let no = 1;
        let delCount = 0;
        rows.push([
          "u", p.productCode, "電球", "s",
          fsOptionCodeReplace(rep.modelNumber ?? ""), choiceLabel(1, rep),
          "0", "1", "", "", "", "",
        ]);
        for (const v of vars) {
          if (v.id === rep.id) continue;
          no++;
          if (v.eosFlag) {
            // 生産終了の選択肢は削除行(登録済み前提)
            rows.push([
              "d", p.productCode, "電球", "s",
              fsOptionCodeReplace(v.modelNumber ?? ""), "", "", "", "", "", "", "",
            ]);
            delCount++;
            continue;
          }
          const diff = (v.price ?? 0) - basePrice;
          rows.push([
            "u", p.productCode, "電球", "s",
            fsOptionCodeReplace(v.modelNumber ?? ""), choiceLabel(no - delCount, v),
            String(diff), String(no - delCount), "", "", "", "",
          ]);
        }
        break;
      }
      case "variation_choice_new":
      case "variation_choice_update": {
        const control = fileType === "variation_choice_new" ? "n" : "u";
        vars.forEach((v, i) => {
          rows.push([
            control, p.productCode, "", "", choiceLabel(i + 1, v), vNo(v), "", "", "", "",
          ]);
        });
        break;
      }
      case "variation_detail": {
        vars.forEach((v, i) => {
          rows.push([
            p.productCode, "", "", choiceLabel(i + 1, v), vNo(v),
            v.isRepresentative ? "1" : "", "", "",
            p.productCode, `${p.productCode}${vNo(v)}`,
            `${productName(p)} ${choiceLabel(i + 1, v)}`, "", "",
          ]);
        });
        break;
      }
      case "variation_stock": {
        for (const v of vars) {
          // 行が生産終了 or 商品が入荷待ちなら在庫0
          const stock = v.eosFlag || p.status === "BACKORDER" ? "0" : "999";
          rows.push([p.productCode, "", "", "", vNo(v), "", stock, "", "", "", "", ""]);
        }
        break;
      }
      case "variation_price": {
        for (const v of vars) {
          rows.push([p.productCode, "", "", "", vNo(v), String(v.price ?? ""), "", "", "", "", ""]);
        }
        break;
      }
      case "category": {
        // 親行が生産終了なら全グループをd(削除)し、最後に「生産終了品」をnで追加。通常はn固定
        // ※現行は「生産終了品」行のコントロールカラムが全角「ｎ」(既知バグ)。半角nで出力する
        const eos = rep?.eosFlag ?? false;
        const control = eos ? "d" : "n";
        for (const cat of plFsCategories(p)) {
          rows.push([control, p.productCode, "", cat, "", ""]);
        }
        if (eos) rows.push(["n", p.productCode, "", "生産終了品", "", ""]);
        break;
      }
    }
  }
  return rows;
}
