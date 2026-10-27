// 楽天用の画像リネーム(楽天スプレッドシートの［画像リネーム］ボタン。GAS「楽天_PL画像リネーム.js」の移植。名前に反して CF・PL 両方)
// - 対象行の画像のうち、画像管理(CF)/(PL) に無いファイルに連番を振り、{フォルダ1}/lib{n}/{7桁}.{拡張子} として ZIP に入れる
//   採番: 番号 = 画像管理の件数 + 1、lib の番号 = floor(番号 / 2000) + 1(2000 ちょうどで lib2 になる。GAS どおり)
// - 元画像は画像画面でアップロードしたもの(ファイル名で引き当て。大文字小文字は区別しない)
// - 画像管理への登録はダウンロード時(commit)。プレビューでは登録しない
// - GAS との違い(不具合の修正): GAS は1行でも元画像が無いと、その回にコピーした画像のフォルダ全体をゴミ箱に移す一方、
//   それまでに振った番号は画像管理に残る(行の途中の番号は欠番になる)。ここでは元画像が無い行だけを登録せず、番号も詰める
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { CONFIG, CONFIG_RAKUTEN } from "./gasConstants.js";
import { loadLedgerRows, type RakutenBook } from "./rakutenData.js";

export type RakutenImagePlan = {
  products: number;
  entries: Array<{ path: string; source: string }>;
  issues: Array<{ productCode: string; fileName: string; reason: string }>;
  commit: () => Promise<void>;
};

export async function planRakutenImages(
  book: RakutenBook,
  where: Prisma.ProductWhereInput,
  storedNames: Set<string>
): Promise<RakutenImagePlan> {
  const existing = await prisma.rakutenImage.findMany({ where: { book }, orderBy: { sortNo: "asc" } });
  // GAS の imgValues(ファイル名が空でない行)。番号はこの件数 + 1
  const imgValues: Array<[number | string, string, string, string, string]> = existing
    .filter((r) => r.fileName !== "")
    .map((r) => [r.no ?? "", r.fileName, r.folder1 ?? "", r.folder2 ?? "", r.renamedName ?? ""]);
  const maxSort = existing.reduce((m, r) => Math.max(m, r.sortNo), 0);

  const imgPosList: number[] = book === "CF" ? CONFIG_RAKUTEN.IMG_CF_POS_LIST : CONFIG_RAKUTEN.IMG_PL_POS_LIST;
  const skipList: number[] = book === "CF" ? [CONFIG.CF_SHEET.LISTITEM_IMG_FEATURE1, CONFIG.CF_SHEET.LISTITEM_IMG_FS_FEATURE] : [];
  const folder1: string = book === "CF" ? CONFIG_RAKUTEN.IMG.CF_FOLDER1 : CONFIG_RAKUTEN.IMG.PL_FORDER1;

  const entries: RakutenImagePlan["entries"] = [];
  const issues: RakutenImagePlan["issues"] = [];
  const toRegister: Array<[number, string, string, string, string]> = [];
  const products = new Set<string>();

  await loadLedgerRows(book, where, (batch) => {
    for (const r of batch) {
      products.add(r.productCode);
      const rowNew: Array<[number, string, string, string, string]> = [];
      const rowErrors: string[] = [];
      for (const imgPos of imgPosList) {
        const imgName = r.cells[imgPos];
        const isExist = imgValues.some((row) => row[1] === imgName);
        if (imgName === "" || imgName === "CUSTOM-SIZE" || isExist || skipList.includes(imgPos)) continue;
        try {
          const extention = (imgName as string).split(".").pop();
          const id = imgValues.length + 1;
          const libNo = Math.floor(id / 2000) + 1;
          const newImg: [number, string, string, string, string] = [
            id,
            imgName as string,
            folder1,
            `${CONFIG_RAKUTEN.IMG.LIB_FOLDER}${libNo}`,
            `${String(id).padStart(7, "0")}.${extention}`,
          ];
          if (!storedNames.has(String(imgName).toLowerCase())) throw new Error(String(imgName));
          if (rowErrors.length > 0) continue; // GAS: 行でエラーが出た後はコピーしない
          rowNew.push(newImg);
          imgValues.push(newImg); // 同じ行・後続の行で同名ファイルを重ねて登録しない(GAS どおり)
        } catch (e) {
          rowErrors.push(e instanceof Error ? e.message : String(e));
        }
      }
      if (rowErrors.length > 0) {
        // 元画像が無い行は登録しない(番号も戻す)
        imgValues.splice(imgValues.length - rowNew.length, rowNew.length);
        for (const name of rowErrors) {
          issues.push({ productCode: r.skuCode ?? r.productCode, fileName: name, reason: "元画像が未アップロードのため、この行の画像は登録しない" });
        }
        continue;
      }
      for (const n of rowNew) {
        entries.push({ path: `${n[2]}/${n[3]}/${n[4]}`, source: n[1] });
        toRegister.push(n);
      }
    }
  });

  return {
    products: products.size,
    entries,
    issues,
    commit: async () => {
      if (toRegister.length === 0) return;
      await prisma.rakutenImage.createMany({
        data: toRegister.map((n, i) => ({
          book,
          sortNo: maxSort + i + 1,
          no: n[0],
          fileName: n[1],
          folder1: n[2],
          folder2: n[3],
          renamedName: n[4],
          path: `${n[2]}/${n[3]}/${n[4]}`,
        })),
      });
    },
  };
}
