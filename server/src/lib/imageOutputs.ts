// 画像ファイルの出力(現行マクロの画像系ボタンの移植)。元画像は画像管理画面でアップロードしたもの(lib/imageAssets.ts)
// - fs_cf   : CF FS_CopyIMG_FmodelName(futureshopIMGE.bas)  一覧用L1→{ID}-01、M1・M2→連番、Googleフィード用 {ID}-feed
// - fs_pl   : PL ★FS_CopyIMG_FmodelName                    メイン画像M01→{fazoo型番}-01
// - list_cf : CF FS_ListIMG_syukusen_FmodelName              L1(無ければM1)を200×200に縮小→{ID}_list(現行は外部ツール「縮専」)
// - yahoo_cf: CF ChangeImageFileName_yahoo(Yahoo作成用.bas)  {id}.jpg・{id}_1〜(小文字)
// - yahoo_pl: PL ChangeImageFileName_yahooPL(YahooIMG.bas。2026-09-29版ブックで追加)  SKU単位で {sku}.jpg・{sku}_1〜(小文字)
// - rakuten_cf / rakuten_pl: 楽天スプレッドシートの［画像リネーム］(lib/rakuten/rakutenImages.ts)。画像管理に無い画像だけを連番で出力し、
//   ダウンロード時に画像管理へ登録する
// 対象は現行と同じく「商品登録フラグ○」の商品。現行の「選択範囲」の代わりに画面の絞り込み(商品コード・メーカー等)を使う
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { planRakutenImages } from "./rakuten/rakutenImages.js";

export const IMAGE_OUTPUT_KINDS = {
  fs_cf: { label: "futureshop 商品画像(CF)", book: "CF" },
  list_cf: { label: "商品一覧用 縮小画像(CF)", book: "CF" },
  yahoo_cf: { label: "Yahoo 商品画像(CF)", book: "CF" },
  fs_pl: { label: "futureshop 商品画像(PL)", book: "PL" },
  yahoo_pl: { label: "Yahoo 商品画像(PL)", book: "PL" },
  rakuten_cf: { label: "楽天 商品画像(CF)", book: "CF" },
  rakuten_pl: { label: "楽天 商品画像(PL)", book: "PL" },
} as const;
export type ImageOutputKind = keyof typeof IMAGE_OUTPUT_KINDS;

export type ImageOutputFilter = {
  productCodes?: string[];
  q?: string;
  makerId?: number;
  updatedFrom?: string;
  updatedTo?: string;
  includeDiscontinued?: boolean; // 生産終了品も出力する(現行の「生産終了データを削除更新しますか？」ではい。fs_cf・list_cf のみ)
};

export type PlannedEntry = { path: string; source: string; resize?: { width: number; height: number } };
export type ImageOutputIssue = { productCode: string; fileName: string; reason: string };
export type ImageOutputPlan = {
  products: number;
  entries: PlannedEntry[];
  issues: ImageOutputIssue[];
  // ダウンロードが終わったときに行う登録(楽天の画像管理への追記)。プレビューでは呼ばない
  commit?: () => Promise<void>;
};

const productInclude = {
  images: true,
  variations: { select: { skuCode: true, listed: true, eosFlag: true, variationNo: true } },
} satisfies Prisma.ProductInclude;
type Product = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

// PLブックの商品コードは「XX-9999…」形式、CFブックは「XXX999」形式(lib/importJobs.ts と同じ判定)
function isPlBookCode(code: string): boolean {
  return /^[A-Z]+-\d/.test(code);
}

function img(p: Product, type: string, sortNo: number): string {
  return p.images.find((i) => i.imageType === type && i.sortNo === sortNo)?.fileName ?? "";
}

// CF: 入荷予定セルが「生産終了」(fsCfGoods.cfIsEos と同じ判定)
function cfIsEos(p: Product): boolean {
  return (p.statusNote ?? "") === "生産終了";
}

function listed(p: Product): boolean {
  return p.variations.some((v) => v.listed);
}

export function imageFilterWhere(f: ImageOutputFilter): Prisma.ProductWhereInput {
  return {
    deletedAt: null,
    ...(f.productCodes?.length && { productCode: { in: f.productCodes } }),
    ...(f.makerId && { makerId: f.makerId }),
    ...((f.updatedFrom || f.updatedTo) && {
      updatedAt: {
        ...(f.updatedFrom && { gte: new Date(`${f.updatedFrom}T00:00:00+09:00`) }),
        ...(f.updatedTo && {
          lt: new Date(new Date(`${f.updatedTo}T00:00:00+09:00`).getTime() + 24 * 60 * 60 * 1000),
        }),
      },
    }),
    ...(f.q && {
      OR: [
        { productCode: { contains: f.q, mode: "insensitive" } },
        { name: { contains: f.q, mode: "insensitive" } },
        { modelNumber: { contains: f.q, mode: "insensitive" } },
      ],
    }),
  };
}

async function loadProducts(kind: ImageOutputKind, f: ImageOutputFilter): Promise<Product[]> {
  const where = imageFilterWhere(f);
  const products = await prisma.product.findMany({ where, include: productInclude, orderBy: { sheetRow: "asc" } });
  const book = IMAGE_OUTPUT_KINDS[kind].book;
  return products.filter((p) => isPlBookCode(p.productCode) === (book === "PL") && listed(p));
}

/** 出力するファイルの一覧を作る(元画像の有無は storedNames(小文字)で判定) */
export async function planImageOutput(
  kind: ImageOutputKind,
  f: ImageOutputFilter,
  storedNames: Set<string>
): Promise<ImageOutputPlan> {
  if (kind === "rakuten_cf" || kind === "rakuten_pl") {
    return planRakutenImages(kind === "rakuten_cf" ? "CF" : "PL", imageFilterWhere(f), storedNames);
  }
  const products = await loadProducts(kind, f);
  const entries: PlannedEntry[] = [];
  const issues: ImageOutputIssue[] = [];
  const has = (name: string) => storedNames.has(name.toLowerCase());
  const missing = (p: Product, fileName: string, reason = "元画像が未アップロード") =>
    issues.push({ productCode: p.productCode, fileName, reason });
  let count = 0;

  for (const p of products) {
    const code = p.productCode;
    if (kind === "fs_cf" || kind === "list_cf") {
      if (cfIsEos(p) && !f.includeDiscontinued) continue;
    }
    if (kind === "yahoo_cf" && cfIsEos(p)) continue;
    count++;

    if (kind === "fs_cf") {
      const l1 = img(p, "LIST", 1);
      let n = 1;
      const dest = () => `FutureshopIMG/${code}-${String(n).padStart(2, "0")}.jpg`;
      if (l1.includes(".jpg")) {
        if (has(l1)) {
          entries.push({ path: dest(), source: l1 });
          n++;
        } else missing(p, l1);
      }
      // メイン画像のみ(M1・M2)。一覧用と同じ画像・CUSTOM-SIZE は除く。番号は元画像の有無にかかわらず進む(現行どおり)
      for (const m of [img(p, "MAIN", 1), img(p, "MAIN", 2)]) {
        if (!m || m === l1 || m === "CUSTOM-SIZE") continue;
        if (!m.includes(".jpg")) {
          missing(p, m, "jpg 以外のためスキップ(現行どおり)");
          continue;
        }
        const path = dest();
        n++;
        if (n > 40) missing(p, m, "画像登録上限(40枚)を超えるためスキップ(現行どおり)");
        else if (has(m)) entries.push({ path, source: m });
        else missing(p, m);
      }
      // Googleショッピングフィード用: 広告用画像(AD1)、無ければメイン画像M1
      const ad = img(p, "AD", 1);
      const m1 = img(p, "MAIN", 1);
      const feed = ad.includes(".jpg") ? ad : m1.includes(".jpg") ? m1 : "";
      if (!feed) missing(p, ad || m1 || "(なし)", "フィード用画像が無い(jpg のみ)");
      else if (has(feed)) entries.push({ path: `feed/${code}-feed.jpg`, source: feed });
      else missing(p, feed);
    } else if (kind === "fs_pl") {
      // 現行は登録フラグ○の行ごとに、その行のメイン画像 M01 を {fazoo管理型番}-01.jpg へ上書きコピーする(最後の行が残る)。
      // 「.jpg」を含むときだけコピー(拡張子が大文字「.JPG」だけの行はコピーされない)
      const rowImages = ((p.extra ?? {}) as { plRowImages?: Record<string, string[]> }).plRowImages ?? {};
      const rows = [...p.variations].sort((a, b) => a.variationNo - b.variationNo).filter((v) => v.listed);
      let last = "";
      for (const v of rows) {
        const m1 = rowImages[v.skuCode]?.[0] ?? img(p, "MAIN", 1);
        if (!m1) missing(p, "(なし)", `メイン画像 M01 が未設定(${v.skuCode})`);
        else if (!m1.includes(".jpg")) missing(p, m1, m1.includes(".JPG") ? "拡張子が大文字のためスキップ(現行どおり)" : "jpg 以外");
        else if (has(m1)) last = m1;
        else missing(p, m1);
      }
      if (last) entries.push({ path: `upload_image/${code}-01.jpg`, source: last });
    } else if (kind === "list_cf") {
      const l1 = img(p, "LIST", 1);
      const m1 = img(p, "MAIN", 1);
      const src = l1.includes(".jpg") ? l1 : m1.includes(".jpg") ? m1 : "";
      if (!src) missing(p, l1 || m1 || "(なし)", "一覧用画像が無い(jpg のみ)");
      else if (has(src)) entries.push({ path: `list/${code}_list.jpg`, source: src, resize: { width: 200, height: 200 } });
      else missing(p, src);
    } else if (kind === "yahoo_cf") {
      // M1〜E1 の順(フリーHTML・動画HTMLの列は画像ではないので除く)。M1 は一覧用L1があれば L1 を {id}.jpg にし、M1 は _1 へ
      const lc = code.toLowerCase();
      const l1 = img(p, "LIST", 1);
      const cols = [
        img(p, "MAIN", 1),
        img(p, "MAIN", 2),
        ...Array.from({ length: 10 }, (_, i) => img(p, "IMAGE", i + 1)),
        img(p, "SIZE", 1),
        img(p, "SIZE", 2),
        ...Array.from({ length: 3 }, (_, i) => img(p, "FUNCTION", i + 1)),
        img(p, "REMOTE", 1),
        img(p, "ACCESSORY", 1),
      ];
      let n = 1;
      cols.forEach((v, idx) => {
        if (!v || v === "CUSTOM-SIZE") return;
        let path: string;
        if (idx === 0 && l1 && v !== l1) {
          if (has(l1)) entries.push({ path: `YahooIMG/${lc}.jpg`, source: l1 });
          else missing(p, l1);
          path = `YahooIMG/${lc}_${n}.jpg`;
          n++;
        } else if (idx === 0) {
          path = `YahooIMG/${lc}.jpg`;
        } else {
          path = `YahooIMG/${lc}_${n}.jpg`;
          n++;
        }
        if (n > 21) missing(p, v, "画像登録上限(メイン1+サブ20)を超えるためスキップ(現行どおり)");
        else if (has(v)) entries.push({ path, source: v });
        else missing(p, v);
      });
    } else if (kind === "yahoo_pl") {
      // SKU(fazoo管理型番ユニーク)単位。販売終了○の行は除く。元画像が無いものは番号を進めずに飛ばす(現行どおり)
      // 画像は行ごとの M01〜F06(extra.plRowImages)。取込前のデータで行の画像が無い場合は商品の画像を使う
      const rowImages = ((p.extra ?? {}) as { plRowImages?: Record<string, string[]> }).plRowImages ?? {};
      const productCols = [
        img(p, "MAIN", 1),
        img(p, "MAIN", 2),
        ...Array.from({ length: 15 }, (_, i) => img(p, "IMAGE", i + 1)),
        ...Array.from({ length: 3 }, (_, i) => img(p, "SIZE", i + 1)),
        ...Array.from({ length: 6 }, (_, i) => img(p, "FUNCTION", i + 1)),
      ];
      const vars = [...p.variations].sort((a, b) => a.variationNo - b.variationNo).filter((v) => v.listed && !v.eosFlag);
      for (const v of vars) {
        const lc = v.skuCode.toLowerCase();
        const cols = rowImages[v.skuCode] ?? productCols;
        let n = 1;
        cols.forEach((name, idx) => {
          if (!name) return;
          if (!has(name)) {
            missing(p, name);
            return;
          }
          if (idx === 0) {
            entries.push({ path: `YahooIMG/${lc}.jpg`, source: name });
          } else if (n <= 21) {
            entries.push({ path: `YahooIMG/${lc}_${n}.jpg`, source: name });
            n++;
          } else {
            missing(p, name, "画像登録上限を超えるためスキップ(現行どおり)");
          }
        });
      }
    }
  }

  // 同じ元画像の不足は商品ごとに1件にまとめる
  const seen = new Set<string>();
  const uniqueIssues = issues.filter((i) => {
    const k = `${i.productCode}\t${i.fileName}\t${i.reason}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { products: count, entries, issues: uniqueIssues };
}
