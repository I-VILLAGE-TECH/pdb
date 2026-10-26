// メーカーマスタの初期値を入れる(表記の正はマスタ管理画面。2026-10-26 決定)
//   npm run db:seed-maker-names(deploy.sh が毎回実行する)
// 画面で変更した値を上書きしないよう、まだ設定されていないメーカー・項目にだけ入れる。
// - CF: 現行マクロの表記(Setメーカー名。lib/cfMakerNames.ts)。区分1・6を和名・英名に、それ以外を cf_notations に入れる。
//       cf_notations が未設定のメーカーだけが対象(設定済みなら和名・英名も触らない)
// - PL: 並び順係数(sort_level が既定値 999 のときだけ)、メイングループ表記の補正(aliases.fsGroupPl が無いときだけ)
import { PrismaClient } from "@prisma/client";
import { cfInitialNotations, CF_MAKER_NAMES } from "../lib/cfMakerNames.js";

const prisma = new PrismaClient();

// PL版の優先度計算用メーカー係数(vba/pendantlight/modules/Common.bas SORT_LEVEL_*)
const PL_MAKER_SORT_LEVELS: Record<string, number> = {
  OD: 1, KO: 2, PN: 3, AW: 4, HM: 5, DC: 6, MR: 7, EX: 8, TS: 9, TO: 10,
  IF: 11, DA: 12, SW: 13, YW: 14, OB: 15, MX: 16, KS: 17, TM: 18, GL: 19,
  CB: 20, AG: 21, AP: 22, GE: 23,
};

// PLのメイングループ表記のうち、シート値の末尾スペースが取込時にtrimされるメーカーの補正
const PL_FS_GROUPS: Record<string, string> = {
  AW: "アートワークスタジオ／ArtWorkStudio ",
  IF: "インターフォルム／INTERFORM ",
};

async function main() {
  // CF: cf_notations が未設定のメーカーだけ初期化する
  let cfInit = 0;
  const cfCodes = Object.keys(CF_MAKER_NAMES[1] ?? {});
  for (const code of cfCodes) {
    const maker = await prisma.maker.findUnique({ where: { makerCode: code } });
    if (!maker || maker.cfNotations != null) continue;
    const init = cfInitialNotations(code);
    if (!init) continue;
    const aliases = {
      ...(typeof maker.aliases === "object" && maker.aliases ? maker.aliases : {}),
      ...(init.cfNotations["10"] ? { fsGroup: init.cfNotations["10"] } : {}),
    };
    await prisma.maker.update({
      where: { id: maker.id },
      data: {
        nameJp: init.nameJp ?? maker.nameJp,
        nameEn: init.nameEn ?? maker.nameEn,
        cfNotations: init.cfNotations,
        aliases,
      },
    });
    cfInit++;
  }
  // PL: メイングループ表記の補正(未設定のときだけ)
  let plGroups = 0;
  for (const [code, fsGroupPl] of Object.entries(PL_FS_GROUPS)) {
    const maker = await prisma.maker.findUnique({ where: { makerCode: code } });
    if (!maker) continue;
    const current = (typeof maker.aliases === "object" && maker.aliases ? maker.aliases : {}) as Record<string, unknown>;
    if (typeof current.fsGroupPl === "string") continue;
    await prisma.maker.update({ where: { id: maker.id }, data: { aliases: { ...current, fsGroupPl } } });
    plGroups++;
  }
  // PL: 並び順係数(既定値 999 のときだけ)
  let sorted = 0;
  for (const [code, level] of Object.entries(PL_MAKER_SORT_LEVELS)) {
    const r = await prisma.maker.updateMany({ where: { makerCode: code, sortLevel: 999 }, data: { sortLevel: level } });
    sorted += r.count;
  }
  console.log(`メーカーマスタの初期値を設定しました(未設定分のみ): CF表記 ${cfInit} 件 / PLグループ表記 ${plGroups} 件 / PL並び順係数 ${sorted} 件`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
