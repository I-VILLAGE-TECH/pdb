// tools/import/extract.py が出力した JSON を基幹DBへ投入する初期移行ローダ
// 実行: npm run db:import（server/ ディレクトリで）
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../tools/import/out");

type MakerJson = {
  makerCode: string;
  nameJp: string;
  nameEn?: string | null;
  imgFolder?: string | null;
};

type ProductJson = Record<string, unknown> & {
  productCode: string;
  category: string;
  productKind: string;
  makerCode?: string | null;
  name: string;
  lightingAttrs?: Record<string, unknown> | null;
  fanAttrs?: Record<string, unknown> | null;
  images?: Array<Record<string, unknown>>;
  variations?: Array<Record<string, unknown>>;
  setComponents?: Array<Record<string, unknown>>;
  channelPrices?: Array<{ channelCode: string; price: number }>;
};

function loadJson<T>(file: string): T | null {
  const p = path.join(OUT_DIR, file);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as T;
}

// null を undefined に変換しつつ Prisma へ渡すヘルパ
function clean<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

async function importMakers(): Promise<Map<string, number>> {
  const makers = loadJson<MakerJson[]>("makers.json") ?? [];
  const map = new Map<string, number>();
  for (const m of makers) {
    const maker = await prisma.maker.upsert({
      where: { makerCode: m.makerCode },
      create: {
        makerCode: m.makerCode,
        nameJp: m.nameJp,
        nameEn: m.nameEn ?? null,
        imgFolder: m.imgFolder ?? null,
      },
      update: { nameJp: m.nameJp, nameEn: m.nameEn ?? null, imgFolder: m.imgFolder ?? null },
    });
    map.set(m.makerCode, maker.id);
  }
  console.log(`makers: ${map.size}`);
  return map;
}

async function importProducts(file: string, makerMap: Map<string, number>) {
  const products = loadJson<ProductJson[]>(file);
  if (!products) {
    console.log(`${file}: なし（スキップ）`);
    return;
  }

  const channels = await prisma.channel.findMany();
  const channelByCode = new Map(channels.map((c) => [c.code, c.id]));

  let ok = 0;
  let failed = 0;
  for (const p of products) {
    try {
      const {
        makerCode,
        lightingAttrs,
        fanAttrs,
        images = [],
        variations = [],
        setComponents = [],
        channelPrices = [],
        ...productFields
      } = p;

      const data = clean({
        ...productFields,
        makerId: makerCode ? makerMap.get(makerCode as string) ?? null : null,
        releaseDate: p.releaseDate ? new Date(p.releaseDate as string) : null,
      }) as unknown as Prisma.ProductUncheckedCreateInput;

      const product = await prisma.product.upsert({
        where: { productCode: p.productCode },
        create: data,
        update: data,
      });

      // 拡張属性（1:1）
      if (lightingAttrs) {
        const attrs = clean(lightingAttrs) as Prisma.ProductLightingAttrsUncheckedCreateInput;
        await prisma.productLightingAttrs.upsert({
          where: { productId: product.id },
          create: { ...attrs, productId: product.id },
          update: attrs,
        });
      }
      if (fanAttrs) {
        const attrs = clean(fanAttrs) as Prisma.ProductFanAttrsUncheckedCreateInput;
        await prisma.productFanAttrs.upsert({
          where: { productId: product.id },
          create: { ...attrs, productId: product.id },
          update: attrs,
        });
      }

      // 画像（洗い替え）
      await prisma.productImage.deleteMany({ where: { productId: product.id } });
      if (images.length > 0) {
        await prisma.productImage.createMany({
          data: images.map((img) => ({
            ...(clean(img) as Prisma.ProductImageCreateManyInput),
            productId: product.id,
          })),
        });
      }

      // バリエーション（skuCode で upsert）
      for (const v of variations) {
        const vData = clean(v) as Prisma.ProductVariationUncheckedCreateInput;
        await prisma.productVariation.upsert({
          where: { skuCode: v.skuCode as string },
          create: { ...vData, productId: product.id },
          update: { ...vData, productId: product.id },
        });
      }

      // セット構成（洗い替え・型番の実体引当は後段）
      await prisma.setComponent.deleteMany({ where: { setProductId: product.id } });
      if (setComponents.length > 0) {
        await prisma.setComponent.createMany({
          data: setComponents.map((c, i) => ({
            ...(clean(c) as Prisma.SetComponentCreateManyInput),
            setProductId: product.id,
            sortNo: i + 1,
          })),
        });
      }

      // 販路別価格
      for (const cp of channelPrices) {
        const channelId = channelByCode.get(cp.channelCode);
        if (!channelId) continue;
        await prisma.productChannelPrice.upsert({
          where: { productId_channelId: { productId: product.id, channelId } },
          create: { productId: product.id, channelId, price: cp.price },
          update: { price: cp.price },
        });
      }

      ok++;
    } catch (e) {
      failed++;
      console.error(`NG ${p.productCode}: ${e instanceof Error ? e.message.split("\n").pop() : e}`);
    }
  }
  console.log(`${file}: 成功 ${ok} / 失敗 ${failed}`);
}

// セット構成の型番→products 引当（component_product_id 解決）
async function resolveSetComponents() {
  const components = await prisma.setComponent.findMany({
    where: { componentProductId: null },
  });
  let resolved = 0;
  for (const c of components) {
    const target = await prisma.product.findFirst({
      where: { OR: [{ modelNumber: c.componentModel }, { productCode: c.componentModel }] },
      select: { id: true },
    });
    if (target) {
      await prisma.setComponent.update({
        where: { id: c.id },
        data: { componentProductId: target.id },
      });
      resolved++;
    }
  }
  console.log(`set components 引当: ${resolved}/${components.length}`);
}

async function main() {
  const makerMap = await importMakers();
  await importProducts("pl_products.json", makerMap);
  await importProducts("cf_products.json", makerMap);
  await resolveSetComponents();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
