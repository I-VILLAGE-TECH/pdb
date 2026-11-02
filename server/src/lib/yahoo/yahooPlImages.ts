// Yahoo PL の画像リネーム(Yahoo(PL)スプレッドシートの［画像リネーム］。GAS「Yahoo_画像コピーネーム.js」の syncAndZipYahooImages の移植)
// - img(商品画像): 行ごとに、画像列の順で {fazoo管理型番(小文字)}.jpg・{…}_1.jpg 〜 _20.jpg(21枚まで)。拡張子は元画像によらず .jpg(GAS どおり)
// - lib(追加画像): 元の名前のまま(同じ名前は1回だけ)。商品説明文の画像は /lib/fan-taro/{元の名前} で参照している
// - 元画像は画像画面でアップロードしたもの(ファイル名で引き当て。大文字小文字は区別しない)
// - GAS との違い: GAS は元画像が1つでも無いと、その回は ZIP を作らない。ここでは無い画像だけを飛ばし(番号は進めない)、一覧に出す
import type { Prisma } from "@prisma/client";
import { loadLedgerRows } from "../rakuten/rakutenData.js";
import { CONFIG, CONFIG_RAKUTEN } from "./gasConstants.js";

export type YahooPlImagePlan = {
  products: number;
  entries: Array<{ path: string; source: string }>;
  issues: Array<{ productCode: string; fileName: string; reason: string }>;
};

export async function planYahooPlImages(
  target: "img" | "lib",
  where: Prisma.ProductWhereInput,
  storedNames: Set<string>
): Promise<YahooPlImagePlan> {
  const imgPosList: number[] = CONFIG_RAKUTEN.IMG_PL_POS_LIST; // GAS も楽天用の列一覧を使っている
  const entries: YahooPlImagePlan["entries"] = [];
  const issues: YahooPlImagePlan["issues"] = [];
  const copiedToLib = new Set<string>();
  const products = new Set<string>();

  await loadLedgerRows("PL", where, (batch) => {
    for (const r of batch) {
      const productManageNo = r.cells[CONFIG.PL_SHEET.LISTITEM_PRODUCT_MANAGE_ID_POS];
      if (!productManageNo) continue;
      products.add(r.productCode);
      const baseCode = String(productManageNo).toLowerCase();
      let imgNum = 0;
      for (const pos of imgPosList) {
        const imgName = r.cells[pos];
        if (!imgName || imgName === "CUSTOM-SIZE") continue;
        if (!storedNames.has(String(imgName).toLowerCase())) {
          issues.push({ productCode: String(productManageNo), fileName: String(imgName), reason: "元画像が未アップロード" });
          continue;
        }
        if (target === "lib") {
          if (!copiedToLib.has(imgName)) {
            entries.push({ path: String(imgName), source: String(imgName) });
            copiedToLib.add(imgName);
          }
        } else if (imgNum <= 20) {
          entries.push({ path: imgNum === 0 ? `${baseCode}.jpg` : `${baseCode}_${imgNum}.jpg`, source: String(imgName) });
        }
        imgNum++;
      }
    }
  });
  return { products: products.size, entries, issues };
}
