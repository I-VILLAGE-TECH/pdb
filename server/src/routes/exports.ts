// プラットフォーム別CSV出力
// channel_field_maps（連携先ごとの出力列定義）を解釈してSKU単位のCSVを生成する。
// 複雑変換は func: キーで本ファイルの関数へ委譲（DB設計 §5.2 / 連携同期共通設計 buildPayload に相当）
import { Router } from "express";
import { z } from "zod";
import iconv from "iconv-lite";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const exportsRouter = Router();

const exportCategoryEnum = z.enum(["PENDANT_LIGHT", "CEILING_LIGHT", "CEILING_FAN", "OTHER"]);

const filterQuery = z.object({
  channelId: z.coerce.number().int(),
  q: z.string().optional(),
  category: exportCategoryEnum.optional(),
  categories: z.array(exportCategoryEnum).optional(), // タブ切替（PLタブ=PL+CL）
  status: z
    .enum([
      "ACTIVE",
      "HIDDEN",
      "DISCONTINUED",
      "DISCONTINUED_IN_STOCK",
      "BACKORDER",
      "RESERVE",
    ])
    .optional(),
  makerId: z.coerce.number().int().optional(),
  updatedFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  updatedTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // マーク付きのみ出力（クライアントのローカルストレージから商品コードを受け取る）
  productCodes: z.array(z.string().min(1)).max(20000).optional(),
});

type Filter = z.infer<typeof filterQuery>;

function buildWhere(f: Filter): Prisma.ProductWhereInput {
  return {
    deletedAt: null,
    ...(f.productCodes && { productCode: { in: f.productCodes } }),
    ...(f.category && { category: f.category }),
    ...(f.categories && { category: { in: f.categories } }),
    ...(f.status && { status: f.status }),
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
        { janCode: { contains: f.q } },
        { variations: { some: { skuCode: { contains: f.q, mode: "insensitive" } } } },
      ],
    }),
  };
}

type ProductFull = Prisma.ProductGetPayload<{
  include: {
    maker: true;
    lightingAttrs: true;
    fanAttrs: true;
    variations: true;
    images: true;
    channelPrices: true;
  };
}>;
type Variation = ProductFull["variations"][number];
type ChannelWithMaps = Prisma.ChannelGetPayload<{ include: { fieldMaps: true } }>;

// ---- source_expr の解決 ----
// - "const:xxx"            → リテラル
// - "func:xxx"             → 変換関数（下記）
// - "product.name" 等      → ドット区切りの属性参照
//   （product / variation / maker / lighting / fan が参照可）

const FUNCS: Record<
  string,
  (p: ProductFull, v: Variation, ch: ChannelWithMaps) => string | number | null
> = {
  // JAN: SKU優先、なければ商品
  jan: (p, v) => v.janCode ?? p.janCode,
  // 価格: channels.price_source に従う（channel_price=販路別価格を優先）
  price: (p, v, ch) => {
    if (ch.priceSource === "channel_price") {
      const cp = p.channelPrices.find((x) => x.channelId === ch.id);
      if (cp) return cp.price;
    }
    return v.price ?? p.totalPrice ?? p.sellingPrice;
  },
  // 在庫: channels.stock_sync_mode に従う（数量 or あり/なし）
  stock: (p, v, ch) => {
    if (ch.stockSyncMode === "AVAILABILITY") return v.stockQty > 0 ? 1 : 0;
    if (ch.stockSyncMode === "NONE") return "";
    return v.stockQty;
  },
  // バリエーション枝番の V01 形式（現行踏襲）
  variation_code: (_p, v) => `V${String(v.variationNo).padStart(2, "0")}`,
  // 表示/公開フラグ: 販売中のみ 1
  display_flag: (p) => (p.status === "ACTIVE" ? 1 : 0),
  // メイン画像ファイル名
  main_image: (p) =>
    p.images
      .filter((i) => i.imageType === "MAIN")
      .sort((a, b) => a.sortNo - b.sortNo)[0]?.fileName ?? "",
  tax_type: (p) => (p.taxType === "TAX_INCLUDED" ? "税込" : "税抜"),
  model_number: (p, v) => v.modelNumber ?? p.modelNumber,
};

function resolveExpr(
  expr: string,
  p: ProductFull,
  v: Variation,
  ch: ChannelWithMaps
): string {
  if (expr.startsWith("const:")) return expr.slice(6);
  if (expr.startsWith("func:")) {
    const fn = FUNCS[expr.slice(5)];
    if (!fn) return `#未実装:${expr}`;
    const result = fn(p, v, ch);
    return result == null ? "" : String(result);
  }
  const ctx: Record<string, unknown> = {
    product: p,
    variation: v,
    maker: p.maker,
    lighting: p.lightingAttrs,
    fan: p.fanAttrs,
  };
  let cur: unknown = ctx;
  for (const key of expr.split(".")) {
    if (cur == null || typeof cur !== "object") return "";
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur == null ? "" : String(cur);
}

function csvField(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function generateRows(f: Filter) {
  const channel = await prisma.channel.findUniqueOrThrow({
    where: { id: f.channelId },
    include: { fieldMaps: { orderBy: { outputColNo: "asc" } } },
  });
  if (channel.fieldMaps.length === 0) {
    throw Object.assign(new Error("この連携先の列定義（channel_field_maps）が未登録です"), {
      status: 400,
    });
  }
  const products = await prisma.product.findMany({
    where: buildWhere(f),
    include: {
      maker: true,
      lightingAttrs: true,
      fanAttrs: true,
      variations: { orderBy: { variationNo: "asc" } },
      images: true,
      channelPrices: true,
    },
    orderBy: { productCode: "asc" },
  });

  const header = channel.fieldMaps.map((m) => m.outputHeader);
  const rows: string[][] = [];
  for (const p of products) {
    for (const v of p.variations) {
      rows.push(channel.fieldMaps.map((m) => resolveExpr(m.sourceExpr, p, v, channel)));
    }
  }
  return { channel, header, rows };
}

import type { Request, Response, NextFunction } from "express";

// GET はクエリ、POST はボディ（productCodes 等の大きな条件はPOSTで受ける）
function parseFilter(req: Request): Filter {
  return filterQuery.parse(req.method === "POST" ? req.body : req.query);
}

// プレビュー（先頭N行をJSONで返す）
async function handlePreview(req: Request, res: Response, next: NextFunction) {
  try {
    const f = parseFilter(req);
    const { channel, header, rows } = await generateRows(f);
    res.json({
      channel: { code: channel.code, name: channel.name, charset: channel.charset },
      header,
      rows: rows.slice(0, 5),
      total: rows.length,
      splitRows: channel.splitRows,
    });
  } catch (e) {
    next(e);
  }
}
exportsRouter.get("/preview", handlePreview);
exportsRouter.post("/preview", handlePreview);

// CSVダウンロード
async function handleCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const f = parseFilter(req);
    const { channel, header, rows } = await generateRows(f);

    const text =
      [header.map(csvField).join(","), ...rows.map((r) => r.map(csvField).join(","))].join(
        "\r\n"
      ) + "\r\n";

    const stamp = new Date()
      .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
      .replace(/[-: ]/g, "")
      .slice(0, 12);
    const filename = `${channel.code}_products_${stamp}.csv`;

    if (channel.charset === "SHIFT_JIS") {
      res.setHeader("Content-Type", "text/csv; charset=Shift_JIS");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(iconv.encode(text, "Shift_JIS"));
    } else {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send("\uFEFF" + text);
    }
  } catch (e) {
    next(e);
  }
}
exportsRouter.get("/csv", handleCsv);
exportsRouter.post("/csv", handleCsv);
