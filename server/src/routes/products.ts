import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import multer from "multer";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { contentTypeFor, removeFile, saveFile } from "../lib/storage.js";

export const productsRouter = Router();

const categoryEnum = z.enum(["PENDANT_LIGHT", "CEILING_LIGHT", "CEILING_FAN", "OTHER"]);
const statusEnum = z.enum([
  "ACTIVE",
  "HIDDEN",
  "DISCONTINUED",
  "DISCONTINUED_IN_STOCK",
  "BACKORDER",
  "RESERVE",
]);
const kindEnum = z.enum(["SINGLE", "VARIATION_PARENT", "SET", "COMPONENT"]);

const listQuery = z.object({
  q: z.string().optional(), // 商品コード/商品名/型番/JAN 部分一致
  category: categoryEnum.optional(),
  status: statusEnum.optional(),
  kind: kindEnum.optional(),
  makerId: z.coerce.number().int().optional(),
  // ---- カラムごとの絞り込み（POST /search のボディで受ける） ----
  productCode: z.string().optional(), // 部分一致
  name: z.string().optional(),
  modelNumber: z.string().optional(),
  janCode: z.string().optional(),
  categories: z.array(categoryEnum).optional(),
  statuses: z.array(statusEnum).optional(),
  kinds: z.array(kindEnum).optional(),
  makerIds: z.array(z.number().int()).optional(),
  suppliers: z.array(z.string()).optional(),
  bodyColors: z.array(z.string()).optional(),
  installationTypes: z.array(z.string()).optional(),
  bulbColors: z.array(z.string()).optional(),
  bulbBases: z.array(z.string()).optional(),
  tatamis: z.array(z.string()).optional(),
  motorTypes: z.array(z.string()).optional(),
  bladeCounts: z.array(z.number().int()).optional(),
  bladeColors: z.array(z.string()).optional(),
  priceMin: z.number().optional(), // 販売価格(totalPrice)
  priceMax: z.number().optional(),
  costMin: z.number().optional(),
  costMax: z.number().optional(),
  listPriceMin: z.number().optional(),
  listPriceMax: z.number().optional(),
  updatedFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // 更新日時（この日以降）
  updatedTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // 更新日時（この日まで・当日含む）
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
  sort: z
    .enum([
      "updatedAt",
      "productCode",
      "name",
      "totalPrice",
      "category",
      "status",
      "productKind",
      "maker",
    ])
    .default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

function buildOrderBy(
  sort: z.infer<typeof listQuery>["sort"],
  order: "asc" | "desc"
): Prisma.ProductOrderByWithRelationInput[] {
  // メーカーは関連テーブルの名前でソート。第2キーに商品コードを固定して順序を安定させる
  const primary: Prisma.ProductOrderByWithRelationInput =
    sort === "maker" ? { maker: { nameJp: order } } : { [sort]: order };
  return [primary, { productCode: "asc" }];
}

const exportFilter = listQuery.extend({
  // マーク付きのみ出力（クライアントのローカルストレージから商品コードを受け取る）
  productCodes: z.array(z.string().min(1)).max(20000).optional(),
});

function buildListWhere(q: z.infer<typeof exportFilter>): Prisma.ProductWhereInput {
  // 照明系拡張・ファン系拡張のカラム絞り込みは1:1リレーションにまとめる
  const lightingWhere: Prisma.ProductLightingAttrsWhereInput = {
    ...(q.installationTypes && { installationType: { in: q.installationTypes } }),
    ...(q.bulbColors && { bulbColor: { in: q.bulbColors } }),
    ...(q.bulbBases && { bulbBase: { in: q.bulbBases } }),
    ...(q.tatamis && { tatami: { in: q.tatamis } }),
  };
  const fanWhere: Prisma.ProductFanAttrsWhereInput = {
    ...(q.motorTypes && { motorType: { in: q.motorTypes } }),
    ...(q.bladeCounts && { bladeCount: { in: q.bladeCounts } }),
    ...(q.bladeColors && { bladeColor1: { in: q.bladeColors } }),
  };
  const range = (min?: number, max?: number) =>
    min != null || max != null
      ? { ...(min != null && { gte: min }), ...(max != null && { lte: max }) }
      : undefined;
  const priceRange = range(q.priceMin, q.priceMax);
  const costRange = range(q.costMin, q.costMax);
  const listPriceRange = range(q.listPriceMin, q.listPriceMax);

  return {
    deletedAt: null,
    ...(q.productCodes && { productCode: { in: q.productCodes } }),
    ...(q.category && { category: q.category }),
    ...(q.status && { status: q.status }),
    ...(q.kind && { productKind: q.kind }),
    ...(q.makerId && { makerId: q.makerId }),
    // カラムごとの絞り込み
    ...(q.productCode && { productCode: { contains: q.productCode, mode: "insensitive" as const } }),
    ...(q.name && { name: { contains: q.name, mode: "insensitive" as const } }),
    ...(q.modelNumber && { modelNumber: { contains: q.modelNumber, mode: "insensitive" as const } }),
    ...(q.janCode && { janCode: { contains: q.janCode } }),
    ...(q.categories && { category: { in: q.categories } }),
    ...(q.statuses && { status: { in: q.statuses } }),
    ...(q.kinds && { productKind: { in: q.kinds } }),
    ...(q.makerIds && { makerId: { in: q.makerIds } }),
    ...(q.suppliers && { supplier: { in: q.suppliers } }),
    ...(q.bodyColors && { bodyColor: { in: q.bodyColors } }),
    ...(Object.keys(lightingWhere).length > 0 && { lightingAttrs: lightingWhere }),
    ...(Object.keys(fanWhere).length > 0 && { fanAttrs: fanWhere }),
    ...(priceRange && { totalPrice: priceRange }),
    ...(costRange && { cost: costRange }),
    ...(listPriceRange && { listPriceExTax: listPriceRange }),
    ...((q.updatedFrom || q.updatedTo) && {
      updatedAt: {
        ...(q.updatedFrom && { gte: new Date(`${q.updatedFrom}T00:00:00+09:00`) }),
        // 終了日は当日いっぱいを含める（翌日0時 JST 未満）
        ...(q.updatedTo && {
          lt: new Date(new Date(`${q.updatedTo}T00:00:00+09:00`).getTime() + 24 * 60 * 60 * 1000),
        }),
      },
    }),
    ...(q.q && {
      OR: [
        { productCode: { contains: q.q, mode: "insensitive" } },
        { name: { contains: q.q, mode: "insensitive" } },
        { modelNumber: { contains: q.q, mode: "insensitive" } },
        { janCode: { contains: q.q } },
        { variations: { some: { skuCode: { contains: q.q, mode: "insensitive" } } } },
      ],
    }),
  };
}

// 一覧（フィルタ＋ページング）
// GET / はクエリ、POST /search はボディ（productCodes=マーク絞り込みはPOSTで受ける）
async function handleList(req: Request, res: Response, next: NextFunction) {
  try {
    const q = exportFilter.parse(req.method === "POST" ? req.body : req.query);
    const where = buildListWhere(q);
    const [total, items] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: {
          maker: true,
          lightingAttrs: true, // 種別ページの固有列表示用
          fanAttrs: true,
          variations: { orderBy: { variationNo: "asc" } },
          images: { where: { imageType: "MAIN" }, orderBy: { sortNo: "asc" }, take: 1 },
        },
        orderBy: buildOrderBy(q.sort, q.order),
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
    ]);
    res.json({ total, page: q.page, perPage: q.perPage, items });
  } catch (e) {
    next(e);
  }
}
productsRouter.get("/", handleList);
productsRouter.post("/search", handleList);

// CSV出力（一覧と同じフィルタ条件で全件）
const CATEGORY_JA: Record<string, string> = {
  PENDANT_LIGHT: "ペンダントライト",
  CEILING_LIGHT: "シーリングライト",
  CEILING_FAN: "シーリングファン",
  OTHER: "その他",
};
const STATUS_JA: Record<string, string> = {
  ACTIVE: "販売中",
  HIDDEN: "非公開",
  DISCONTINUED: "生産終了",
  DISCONTINUED_IN_STOCK: "終了・在庫有",
  BACKORDER: "入荷待ち",
  RESERVE: "予約",
};
const KIND_JA: Record<string, string> = {
  SINGLE: "単品",
  VARIATION_PARENT: "バリエーション親",
  SET: "セット",
  COMPONENT: "構成部材",
};

function csvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function handleExport(req: Request, res: Response, next: NextFunction) {
  try {
    const q = exportFilter.parse(req.method === "POST" ? req.body : req.query);
    const where = buildListWhere(q);
    const items = await prisma.product.findMany({
      where,
      include: { maker: true, variations: true },
      orderBy: buildOrderBy(q.sort, q.order),
    });

    const header = [
      "商品コード", "種別", "区分", "商品名", "メーカー", "本体型番", "JAN",
      "状態", "仕入値(税抜)", "定価(税抜)", "販売価格(税込)", "合計販売価格",
      "仕入先", "SKU数", "在庫合計", "更新日時",
    ];
    const lines = items.map((p) =>
      [
        p.productCode,
        CATEGORY_JA[p.category] ?? p.category,
        KIND_JA[p.productKind] ?? p.productKind,
        p.name,
        p.maker?.nameJp ?? "",
        p.modelNumber ?? "",
        p.janCode ?? "",
        STATUS_JA[p.status] ?? p.status,
        p.cost ?? "",
        p.listPriceExTax ?? "",
        p.sellingPrice ?? "",
        p.totalPrice ?? "",
        p.supplier ?? "",
        p.variations.length,
        p.variations.reduce((a, v) => a + v.stockQty, 0),
        p.updatedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
      ]
        .map(csvField)
        .join(",")
    );
    // BOM付きUTF-8（Excelでの文字化け防止）
    const csv = "\uFEFF" + [header.map(csvField).join(","), ...lines].join("\r\n") + "\r\n";

    const now = new Date();
    const stamp = now
      .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
      .replace(/[-: ]/g, "")
      .slice(0, 12);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="products_${stamp}.csv"`);
    res.send(csv);
  } catch (e) {
    next(e);
  }
}
productsRouter.get("/export", handleExport);
productsRouter.post("/export", handleExport);

// カラム絞り込み用の候補値（実データのdistinct）
const facetFields = z.enum([
  "supplier",
  "bodyColor",
  "installationType",
  "bulbColor",
  "bulbBase",
  "tatami",
  "motorType",
  "bladeCount",
  "bladeColor1",
]);

productsRouter.get("/facets", async (req, res, next) => {
  try {
    const { field, categories } = z
      .object({
        field: facetFields,
        categories: z.string().optional(), // カンマ区切り
      })
      .parse(req.query);
    const categoryList = categories
      ? z.array(categoryEnum).parse(categories.split(","))
      : undefined;
    const productWhere = {
      deletedAt: null,
      ...(categoryList && { category: { in: categoryList } }),
    };

    let values: unknown[] = [];
    if (field === "supplier" || field === "bodyColor") {
      const rows = await prisma.product.findMany({
        where: productWhere,
        distinct: [field],
        select: { [field]: true },
      });
      values = rows.map((r) => (r as Record<string, unknown>)[field]);
    } else if (["installationType", "bulbColor", "bulbBase", "tatami"].includes(field)) {
      const rows = await prisma.productLightingAttrs.findMany({
        where: { product: productWhere },
        distinct: [field as "installationType"],
        select: { [field]: true },
      });
      values = rows.map((r) => (r as Record<string, unknown>)[field]);
    } else {
      const rows = await prisma.productFanAttrs.findMany({
        where: { product: productWhere },
        distinct: [field as "motorType"],
        select: { [field]: true },
      });
      values = rows.map((r) => (r as Record<string, unknown>)[field]);
    }

    const list = [...new Set(values.filter((v) => v !== null && v !== ""))]
      .map((v) => v as string | number)
      .sort((a, b) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "ja")))
      .slice(0, 500);
    res.json(list);
  } catch (e) {
    next(e);
  }
});

// 詳細
productsRouter.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        maker: true,
        lightingAttrs: true,
        fanAttrs: true,
        variations: { orderBy: { variationNo: "asc" } },
        images: { orderBy: [{ imageType: "asc" }, { sortNo: "asc" }] },
        setComponents: {
          include: { componentProduct: { select: { id: true, productCode: true, name: true, totalPrice: true } } },
          orderBy: { sortNo: "asc" },
        },
        categories: { include: { category: true } },
        channelPrices: { include: { channel: true } },
        channelLinks: { include: { channel: true, variation: true } },
      },
    });
    if (!product) return res.status(404).json({ error: "not found" });
    res.json(product);
  } catch (e) {
    next(e);
  }
});

// 照明系拡張属性（登録・更新用）
const lightingAttrsBody = z.object({
  bulbType: z.string().nullish(),
  bulbKind: z.string().nullish(),
  initialBulbType: z.string().nullish(),
  bulbColor: z.string().nullish(),
  bulbBase: z.string().nullish(),
  mainBulbCount: z.number().int().nullish(),
  subBulb: z.string().nullish(),
  bulbReplacement: z.string().nullish(),
  bundledBulbModel: z.string().nullish(),
  brightnessLm: z.string().nullish(),
  colorTempLow: z.number().int().nullish(),
  colorTempHigh: z.number().int().nullish(),
  raValue: z.number().int().nullish(),
  wattEquivalent: z.string().nullish(),
  wattEquivalentTable: z.string().nullish(),
  dimmingMethod: z.string().nullish(),
  stepSwitching: z.boolean().optional(),
  pullSwitch: z.boolean().optional(),
  remoteIncluded: z.boolean().optional(),
  installationCode: z.string().nullish(),
  installationType: z.string().nullish(),
  inclinedCeiling: z.string().nullish(),
  highCeiling: z.boolean().optional(),
  cordStorage: z.string().nullish(),
  attachableCount: z.number().int().nullish(),
  tatami: z.string().nullish(),
  roomWholeLighting: z.boolean().optional(),
  material: z.string().nullish(),
});

// ファン系拡張属性（登録・更新用）
const fanAttrsBody = z.object({
  motorType: z.string().nullish(),
  bladeCount: z.number().int().nullish(),
  windSpeed: z.number().nullish(),
  windVolume: z.number().nullish(),
  rotationSpeed: z.number().int().nullish(),
  windLevels: z.number().int().nullish(),
  powerConsumptionW: z.number().nullish(),
  extensionPipe: z.string().nullish(),
  pipeVariation: z.string().nullish(),
  mountType: z.string().nullish(),
  heightToBladeMm: z.number().int().nullish(),
  lightCount: z.number().int().nullish(),
  lightKind: z.string().nullish(),
  lightColor: z.string().nullish(),
  bladeColor1: z.string().nullish(),
  bladeColor2: z.string().nullish(),
  colorCategory: z.string().nullish(),
  rhythmMode: z.boolean().optional(),
  dimming: z.string().nullish(),
  remoteIncluded: z.boolean().optional(),
  batteryType: z.string().nullish(),
  batteryCount: z.number().int().nullish(),
  brightnessLm: z.number().int().nullish(),
  wattEquivalent: z.string().nullish(),
  tatamiFrom: z.number().int().nullish(),
  tatamiTo: z.number().int().nullish(),
  angledCeiling: z.string().nullish(),
  fanGrade: z.string().nullish(),
});

const productBody = z.object({
  productCode: z.string().min(1),
  category: categoryEnum,
  productKind: kindEnum.default("SINGLE"),
  name: z.string().min(1),
  makerId: z.number().int().nullish(),
  status: statusEnum.default("ACTIVE"),
  seriesCode: z.string().nullish(),
  genreCode: z.string().nullish(),
  seqNo: z.number().int().nullish(),
  summary: z.string().nullish(),
  modelNumber: z.string().nullish(),
  combinationModel: z.string().nullish(),
  janCode: z.string().nullish(),
  statusNote: z.string().nullish(),
  successorModel: z.string().nullish(),
  releaseDate: z.string().datetime().nullish().or(z.null()),
  // 価格
  cost: z.number().int().nullish(),
  costInTax: z.number().int().nullish(),
  listPriceExTax: z.number().int().nullish(),
  listPriceInTax: z.number().int().nullish(),
  isOpenPrice: z.boolean().optional(),
  sellingPriceExTax: z.number().int().nullish(),
  sellingPrice: z.number().int().nullish(),
  totalPrice: z.number().int().nullish(),
  priceControlled: z.boolean().optional(),
  taxType: z.enum(["TAX_INCLUDED", "TAX_EXCLUDED"]).optional(),
  pointRate: z.number().nullish(),
  supplier: z.string().nullish(),
  shippingEstimate: z.number().int().nullish(),
  // 寸法・共通
  widthMm: z.number().int().nullish(),
  depthMm: z.number().int().nullish(),
  heightMm: z.number().int().nullish(),
  height2Mm: z.number().int().nullish(),
  totalHeightMinMm: z.number().int().nullish(),
  totalHeightMaxMm: z.number().int().nullish(),
  weightKg: z.number().nullish(),
  warranty: z.string().nullish(),
  moneyBackDays: z.number().int().nullish(),
  countryOfOrigin: z.string().nullish(),
  goodDesignYear: z.number().int().nullish(),
  bodyColor: z.string().nullish(),
  // 文章
  comment: z.string().nullish(),
  detail: z.string().nullish(),
  // 運用
  isNew: z.boolean().optional(),
  isRecommended: z.boolean().optional(),
  isSameDayShipping: z.boolean().optional(),
  sortNo: z.number().int().nullish(),
  shippingLeadTime: z.string().nullish(),
  fsShippingPattern: z.string().nullish(),
  relatedProducts: z.string().nullish(),
  exampleUrl: z.string().nullish(),
  memo: z.string().nullish(),
  // 種別拡張属性（ネスト）
  lightingAttrs: lightingAttrsBody.optional(),
  fanAttrs: fanAttrsBody.optional(),
});

// 一括保存（スプレッドシートUI用）: id ありは更新、id なしは新規作成
// 行ごとに結果を返す（1行の失敗で全体を止めない）
productsRouter.post("/bulk", async (req, res, next) => {
  try {
    const rows = z
      .array(
        productBody
          .partial()
          .extend({ id: z.number().int().optional() })
          .refine((r) => r.id != null || (r.productCode && r.name && r.category), {
            message: "新規行には productCode / category / name が必要です",
          })
      )
      .min(1)
      .max(500)
      .parse(req.body);

    const results: Array<{ id?: number; productCode?: string; ok: boolean; error?: string }> = [];
    for (const row of rows) {
      // シート編集はフラットな商品列のみ扱う（拡張属性・発売日はここでは対象外）
      const { id, lightingAttrs: _l, fanAttrs: _f, releaseDate: _r, ...fields } = row;
      try {
        if (id != null) {
          const updated = await prisma.product.update({ where: { id }, data: fields });
          results.push({ id, productCode: updated.productCode, ok: true });
        } else {
          const created = await prisma.product.create({
            data: {
              ...(fields as Prisma.ProductUncheckedCreateInput),
              variations: {
                create: {
                  variationNo: 1,
                  skuCode: `${fields.productCode}v1`,
                  isRepresentative: true,
                  price: fields.totalPrice ?? fields.sellingPrice ?? null,
                },
              },
            },
          });
          results.push({ id: created.id, productCode: created.productCode, ok: true });
        }
      } catch (e) {
        results.push({
          id,
          productCode: row.productCode ?? undefined,
          ok: false,
          error: e instanceof Error ? e.message.split("\n").pop() : String(e),
        });
      }
    }
    const okCount = results.filter((r) => r.ok).length;
    res.json({ ok: okCount, failed: results.length - okCount, results });
  } catch (e) {
    next(e);
  }
});

// 新規作成（variation_no=1 の代表SKUを自動作成。種別拡張属性もネストで受ける）
productsRouter.post("/", async (req, res, next) => {
  try {
    const { lightingAttrs, fanAttrs, releaseDate, ...body } = productBody.parse(req.body);
    const product = await prisma.product.create({
      data: {
        ...body,
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        ...(lightingAttrs && { lightingAttrs: { create: lightingAttrs } }),
        ...(fanAttrs && { fanAttrs: { create: fanAttrs } }),
        variations: {
          create: {
            variationNo: 1,
            skuCode: `${body.productCode}v1`,
            isRepresentative: true,
            price: body.totalPrice ?? body.sellingPrice ?? null,
          },
        },
      },
      include: { variations: true, lightingAttrs: true, fanAttrs: true },
    });
    res.status(201).json(product);
  } catch (e) {
    next(e);
  }
});

// 更新（種別拡張属性は upsert）
productsRouter.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { lightingAttrs, fanAttrs, releaseDate, ...body } = productBody
      .partial()
      .parse(req.body);
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...body,
        ...(releaseDate !== undefined && {
          releaseDate: releaseDate ? new Date(releaseDate) : null,
        }),
        ...(lightingAttrs && {
          lightingAttrs: { upsert: { create: lightingAttrs, update: lightingAttrs } },
        }),
        ...(fanAttrs && { fanAttrs: { upsert: { create: fanAttrs, update: fanAttrs } } }),
      },
    });
    res.json(product);
  } catch (e) {
    next(e);
  }
});

// 論理削除
productsRouter.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ---- バリエーション（SKU） ----

const variationBody = z.object({
  variationNo: z.number().int().min(1),
  axisName: z.string().nullish(),
  optionValue: z.string().nullish(),
  modelNumber: z.string().nullish(),
  janCode: z.string().nullish(),
  stockQty: z.number().int().min(0).default(0),
  price: z.number().int().nullish(),
  isRepresentative: z.boolean().optional(),
  sortNo: z.number().int().nullish(),
});

productsRouter.post("/:id/variations", async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    const body = variationBody.parse(req.body);
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: { _count: { select: { variations: true } } },
    });
    const variation = await prisma.productVariation.create({
      data: {
        ...body,
        productId,
        skuCode: `${product.productCode}v${body.variationNo}`,
      },
    });
    // 子（バリエーション）が2件以上になったら親商品の区分を「バリエーション親」に揃える
    if (product.productKind === "SINGLE" && product._count.variations >= 1) {
      await prisma.product.update({
        where: { id: productId },
        data: { productKind: "VARIATION_PARENT" },
      });
    }
    res.status(201).json(variation);
  } catch (e) {
    next(e);
  }
});

productsRouter.put("/:id/variations/:variationId", async (req, res, next) => {
  try {
    const variationId = Number(req.params.variationId);
    const body = variationBody.partial().parse(req.body);
    const { variationNo: _ignored, ...data } = body;
    const variation = await prisma.productVariation.update({
      where: { id: variationId },
      data,
    });
    res.json(variation);
  } catch (e) {
    next(e);
  }
});

productsRouter.delete("/:id/variations/:variationId", async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    const count = await prisma.productVariation.count({ where: { productId } });
    // 単品も v1 を1件持つ設計のため、最後の1件は削除不可
    if (count <= 1) {
      return res.status(400).json({ error: "最後のバリエーションは削除できません（単品も代表SKUを1件持つ設計です）" });
    }
    await prisma.productVariation.delete({
      where: { id: Number(req.params.variationId) },
    });
    // 残り1件になったら区分を単品へ戻す
    if (count - 1 === 1) {
      await prisma.product.updateMany({
        where: { id: productId, productKind: "VARIATION_PARENT" },
        data: { productKind: "SINGLE" },
      });
    }
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ---- 画像（アップロード / 削除 / メタ更新） ----

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const IMAGE_TYPES = [
  "MAIN", "IMAGE", "SIZE", "FUNCTION", "REMOTE", "ACCESSORY", "LIST", "BANNER", "AD", "ORIGINAL", "FEATURE",
] as const;

productsRouter.post("/:id/images", imageUpload.single("file"), async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    if (!req.file) return res.status(400).json({ error: "ファイルが指定されていません" });
    const { imageType } = z.object({ imageType: z.enum(IMAGE_TYPES).default("IMAGE") }).parse(req.body);

    const originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const ext = path.extname(originalName).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"].includes(ext)) {
      return res.status(400).json({ error: "画像ファイル（jpg/png/gif/webp/avif）を指定してください" });
    }
    await prisma.product.findUniqueOrThrow({ where: { id: productId } });

    // 種別内の次の順序番号
    const last = await prisma.productImage.findFirst({
      where: { productId, imageType },
      orderBy: { sortNo: "desc" },
    });
    const key = `images/${productId}/${randomUUID()}${ext}`;
    await saveFile(key, req.file.buffer, contentTypeFor(originalName));

    const image = await prisma.productImage.create({
      data: {
        productId,
        imageType,
        sortNo: (last?.sortNo ?? 0) + 1,
        fileName: originalName,
        url: `/uploads/${key}`,
      },
    });
    res.status(201).json(image);
  } catch (e) {
    next(e);
  }
});

productsRouter.delete("/:id/images/:imageId", async (req, res, next) => {
  try {
    const image = await prisma.productImage.delete({
      where: { id: Number(req.params.imageId) },
    });
    if (image.url?.startsWith("/uploads/")) {
      await removeFile(image.url.slice("/uploads/".length));
    }
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// 在庫のみ更新（UC③）
productsRouter.patch("/:id/variations/:variationId/stock", async (req, res, next) => {
  try {
    const { stockQty } = z.object({ stockQty: z.number().int().min(0) }).parse(req.body);
    const variation = await prisma.productVariation.update({
      where: { id: Number(req.params.variationId) },
      data: { stockQty },
    });
    // 親の updatedAt も進めて差分抽出対象にする
    await prisma.product.update({
      where: { id: variation.productId },
      data: { updatedAt: new Date() },
    });
    res.json(variation);
  } catch (e) {
    next(e);
  }
});
