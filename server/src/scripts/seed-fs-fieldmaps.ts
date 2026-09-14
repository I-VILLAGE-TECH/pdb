// futureshop の channel_field_maps を FS_ccGoods 商品CSV(111列)の本仕様に差し替える
//   npm run db:seed-fs
// 列定義は src/lib/fsGoodsColumns.ts(現行Excelの出力シートヘッダーから抽出した実物)。
// 既存のfutureshop列定義(たたき台含む)を削除して投入し直す(何度でも実行可)。
import { PrismaClient } from "@prisma/client";
import { FS_CCGOODS_COLUMNS } from "../lib/fsGoodsColumns.js";

const prisma = new PrismaClient();

async function main() {
  const channel = await prisma.channel.findUnique({ where: { code: "futureshop" } });
  if (!channel) {
    console.error("abort: channels に code=futureshop がありません。先に npm run db:seed を実行してください");
    process.exitCode = 1;
    return;
  }
  const deleted = await prisma.channelFieldMap.deleteMany({ where: { channelId: channel.id } });
  await prisma.channelFieldMap.createMany({
    data: FS_CCGOODS_COLUMNS.map(([header, expr], i) => ({
      channelId: channel.id,
      outputColNo: i,
      outputHeader: header,
      sourceExpr: expr,
    })),
  });
  console.log(
    `futureshop: 旧${deleted.count}列 → FS_ccGoods ${FS_CCGOODS_COLUMNS.length}列を投入しました`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
