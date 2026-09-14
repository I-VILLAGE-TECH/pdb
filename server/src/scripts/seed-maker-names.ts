// CF系メーカーの表記をVBAの表記マスタ(Setメーカー名)に合わせて補正する
//   npm run db:seed-maker-names
// 出典: vba/ceilingfan/modules/Shopserve用.bas:2035 Setメーカー名
//   Case 1(日本語表記)→nameJp / Case 6(英語表記)→nameEn / Case 10(FSカテゴリ・グループ用)→aliases.fsGroup
// futureshop商品CSVのメイングループ・商品名・キーワード再現に必要。何度でも実行可(上書き)。
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// makerCode → [カナ(Case1), 英語(Case6), FSグループ表記(Case10)]
const CF_MAKER_NAMES: Record<string, [string, string, string]> = {
  I: ["ファズー", "I.VILLAGE", "ファズーファン／FAZOO FAN"],
  A: ["アグレッド", "AGLED", "アグレッド／AGLED"],
  N: ["NEC", "NEC_LIGHTING", "NEC"],
  O: ["オーデリック", "ODELIC", "オーデリック／ODELIC"],
  R: ["オーブ", "ORRB", "オーブ／ORRB"],
  K: ["コイズミ", "KOIZUMI", "コイズミ照明／KOIZUMI"],
  W: ["ライフオンプロダクツ", "LIFE ON PRODUCTS", "JAVALO ELF／ライフオンプロダクツ"],
  D: ["ダイコー", "DAIKO", "大光電機／DAIKO"],
  Z: ["タキズミ", "TAKIZUMI", "瀧住電機工業／TAKIZUMI"],
  L: ["ダルトン", "DULTON", "ダルトン／DULTON"],
  M: ["東京メタル工業", "TOKYOMETAL", "東京メタル工業／Tome"],
  T: ["東芝", "TOSHIBA", "東芝／TOSHIBA"],
  J: ["日本電興", "NIHONDENKO", "日本電興／NIHON DENKO"],
  P: ["パナソニック", "PANASONIC", "パナソニック／Panasonic"],
  H: ["ハモサ", "HERMOSA", "ハモサ／HERMOSA"],
  PH: ["ファイテン", "PHITEN", "ファイテン／phiten"],
  MA: ["マントラ", "MANTRA", "マントラ／mAntra"],
  E: ["三菱電機", "MITSUBISHI ELECTRIC", "三菱電機／MITSUBISHI"],
  X: ["BRID[メルクロス]", "BRID MERCROS", "メルクロス／BRID"],
  Y: ["ユーワ", "YOUWA", "ユーワ／YOUWA"],
  IM: ["ミンカエアー", "MINKA AIRE", "海外／輸入ファン"],
};

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
  let updated = 0;
  for (const [code, [kana, en, fsGroup]] of Object.entries(CF_MAKER_NAMES)) {
    const maker = await prisma.maker.findUnique({ where: { makerCode: code } });
    if (!maker) continue;
    const aliases = {
      ...(typeof maker.aliases === "object" && maker.aliases ? maker.aliases : {}),
      fsGroup,
    };
    await prisma.maker.update({
      where: { id: maker.id },
      data: { nameJp: kana, nameEn: en, aliases },
    });
    updated++;
  }
  let plGroups = 0;
  for (const [code, fsGroupPl] of Object.entries(PL_FS_GROUPS)) {
    const maker = await prisma.maker.findUnique({ where: { makerCode: code } });
    if (!maker) continue;
    const aliases = { ...(typeof maker.aliases === "object" && maker.aliases ? maker.aliases : {}), fsGroupPl };
    await prisma.maker.update({ where: { id: maker.id }, data: { aliases } });
    plGroups++;
  }
  let sorted = 0;
  for (const [code, level] of Object.entries(PL_MAKER_SORT_LEVELS)) {
    const r = await prisma.maker.updateMany({ where: { makerCode: code }, data: { sortLevel: level } });
    sorted += r.count;
  }
  console.log(`メーカー表記を補正しました: ${updated} 件 / PLグループ表記: ${plGroups} 件 / PL並び順係数: ${sorted} 件`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
