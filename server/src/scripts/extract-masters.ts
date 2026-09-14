// 既存の商品データから「マスタとすべき項目」の値を抽出して master_items に投入する。
// 何度実行しても既存マスタは上書きしない（skipDuplicates）。
// 実行: npm run db:extract-masters
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function distinctValues(rows: Array<{ v: string | null }>): Promise<string[]> {
  const set = new Set<string>();
  for (const r of rows) {
    const v = r.v?.trim();
    if (v) set.add(v);
  }
  return [...set].sort();
}

async function main() {
  const sources: Array<{ type: string; values: string[] }> = [];

  const products = await prisma.product.findMany({
    select: { supplier: true, warranty: true, bodyColor: true },
  });
  sources.push({ type: "supplier", values: await distinctValues(products.map((p) => ({ v: p.supplier }))) });
  sources.push({ type: "warranty", values: await distinctValues(products.map((p) => ({ v: p.warranty }))) });
  sources.push({ type: "body_color", values: await distinctValues(products.map((p) => ({ v: p.bodyColor }))) });

  const lighting = await prisma.productLightingAttrs.findMany({
    select: { installationType: true, bulbBase: true, bulbColor: true, material: true },
  });
  sources.push({ type: "installation_type", values: await distinctValues(lighting.map((a) => ({ v: a.installationType }))) });
  sources.push({ type: "bulb_base", values: await distinctValues(lighting.map((a) => ({ v: a.bulbBase }))) });
  sources.push({ type: "bulb_color", values: await distinctValues(lighting.map((a) => ({ v: a.bulbColor }))) });
  sources.push({ type: "material", values: await distinctValues(lighting.map((a) => ({ v: a.material }))) });

  const fans = await prisma.productFanAttrs.findMany({
    select: { lightColor: true, motorType: true },
  });
  sources.push({ type: "light_color", values: await distinctValues(fans.map((a) => ({ v: a.lightColor }))) });
  sources.push({ type: "motor_type", values: await distinctValues(fans.map((a) => ({ v: a.motorType }))) });

  for (const s of sources) {
    const result = await prisma.masterItem.createMany({
      data: s.values.map((value, i) => ({ type: s.type, value, sortNo: i + 1 })),
      skipDuplicates: true,
    });
    console.log(`${s.type}: ${result.count} 件追加（抽出 ${s.values.length} 件）`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
