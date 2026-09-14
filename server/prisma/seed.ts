// channels 初期データ（DB設計 §5.1 の初期データ例 + 連携同期共通設計 §7）
// ＋ 初期管理者ユーザー
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const channels = [
  {
    code: "futureshop",
    name: "futureshop",
    transferType: "FTP",
    charset: "SHIFT_JIS",
    stockSyncMode: "QUANTITY",
    priceSource: "total_price",
    upsertMode: "EXPLICIT_NUD",
    splitRows: 700,
    active: true,
    verifySource: "MAIL",
  },
  {
    code: "yahoo",
    name: "Yahoo!ショッピング",
    transferType: "CSV",
    charset: "SHIFT_JIS",
    stockSyncMode: "QUANTITY",
    priceSource: "total_price",
    upsertMode: "FULL_REPLACE",
    active: true,
    verifySource: "NONE",
  },
  {
    code: "rakuten",
    name: "楽天",
    transferType: "CSV",
    charset: "SHIFT_JIS",
    stockSyncMode: "QUANTITY",
    priceSource: "total_price",
    upsertMode: "FULL_REPLACE",
    active: true,
    verifySource: "NONE",
  },
  {
    code: "amazon",
    name: "Amazon",
    transferType: "API",
    charset: "UTF8",
    stockSyncMode: "AVAILABILITY",
    priceSource: "channel_price",
    upsertMode: "PARTIAL_UPDATE",
    active: true,
    verifySource: "FEED_REPORT",
  },
  {
    code: "nextengine",
    name: "ネクストエンジン",
    transferType: "API",
    charset: "UTF8",
    stockSyncMode: "QUANTITY",
    priceSource: "total_price",
    upsertMode: "PARTIAL_UPDATE",
    active: true,
    verifySource: "API_FETCH",
  },
  {
    code: "shopserve_wp",
    name: "ショップサーブ(WP)",
    transferType: "CSV",
    charset: "UTF8",
    stockSyncMode: "NONE",
    priceSource: "total_price",
    upsertMode: "FULL_REPLACE",
    active: false,
    verifySource: "NONE",
  },
] as const;

// 連携先別CSVの列定義（たたき台）。本仕様は個別設計（D2-x）確定時に差し替える。
// source_expr: 属性参照（product./variation./maker./lighting./fan.）/ const:リテラル / func:変換関数
const fieldMaps: Record<string, Array<[string, string]>> = {
  futureshop: [
    ["コントロールカラム", "const:u"],
    ["商品番号", "variation.skuCode"],
    ["商品名", "product.name"],
    ["商品説明", "product.comment"],
    ["メーカー型番", "func:model_number"],
    ["JANコード", "func:jan"],
    ["販売価格", "func:price"],
    ["税区分", "func:tax_type"],
    ["在庫数", "func:stock"],
    ["表示フラグ", "func:display_flag"],
    ["メイン画像", "func:main_image"],
    ["メーカー名", "maker.nameJp"],
  ],
  yahoo: [
    ["code", "variation.skuCode"],
    ["name", "product.name"],
    ["price", "func:price"],
    ["quantity", "func:stock"],
    ["jan", "func:jan"],
    ["brand", "maker.nameJp"],
    ["model", "func:model_number"],
    ["caption", "product.comment"],
    ["display", "func:display_flag"],
  ],
  rakuten: [
    ["商品管理番号（商品URL）", "variation.skuCode"],
    ["商品番号", "func:model_number"],
    ["商品名", "product.name"],
    ["販売価格", "func:price"],
    ["在庫数", "func:stock"],
    ["カタログID", "func:jan"],
    ["PC用商品説明文", "product.comment"],
    ["倉庫指定", "func:display_flag"],
  ],
  amazon: [
    ["sku", "variation.skuCode"],
    ["product-id", "func:jan"],
    ["product-id-type", "const:EAN"],
    ["price", "func:price"],
    ["quantity", "func:stock"],
    ["add-delete", "const:a"],
  ],
  nextengine: [
    ["商品コード", "variation.skuCode"],
    ["商品名", "product.name"],
    ["JANコード", "func:jan"],
    ["原価", "product.cost"],
    ["売価", "func:price"],
    ["在庫数", "func:stock"],
    ["メーカー名", "maker.nameJp"],
    ["型番", "func:model_number"],
  ],
};

async function main() {
  for (const c of channels) {
    await prisma.channel.upsert({
      where: { code: c.code },
      create: c,
      update: {},
    });
  }
  console.log(`seeded ${channels.length} channels`);

  // 列定義: その連携先にまだ1件も無い場合のみ投入（運用で編集した定義を上書きしない）
  for (const [code, maps] of Object.entries(fieldMaps)) {
    const channel = await prisma.channel.findUnique({
      where: { code },
      include: { _count: { select: { fieldMaps: true } } },
    });
    if (!channel || channel._count.fieldMaps > 0) continue;
    await prisma.channelFieldMap.createMany({
      data: maps.map(([outputHeader, sourceExpr], i) => ({
        channelId: channel.id,
        outputColNo: i + 1,
        outputHeader,
        sourceExpr,
      })),
    });
    console.log(`seeded ${maps.length} field maps for ${code}`);
  }

  // 初期管理者（ユーザーが1人もいない場合のみ作成）
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
    const password = process.env.ADMIN_INITIAL_PASSWORD ?? "admin1234";
    await prisma.user.create({
      data: {
        email,
        name: "管理者",
        role: "ADMIN",
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    console.log(`seeded initial admin user: ${email}`);
    if (!process.env.ADMIN_INITIAL_PASSWORD) {
      console.warn("WARNING: 初期パスワードは admin1234 です。ログイン後に必ず変更してください");
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
