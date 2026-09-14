import { Router } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import type { Prisma } from "@prisma/client";

export const syncRouter = Router();

// ------------------------------------------------------------
// 差分計算（3層比較の local 層）— 共通設計 §4
// channel_field_maps による変換は各アダプタで実装する。
// ここでは共通の正規化ペイロード（連携対象の主要属性）でハッシュ比較する。
// ------------------------------------------------------------

type VariationWithProduct = Prisma.ProductVariationGetPayload<{
  include: { product: true };
}>;

function buildLocalPayload(v: VariationWithProduct) {
  const p = v.product;
  return {
    skuCode: v.skuCode,
    productCode: p.productCode,
    name: p.name,
    modelNumber: v.modelNumber ?? p.modelNumber,
    janCode: v.janCode ?? p.janCode,
    price: v.price ?? p.totalPrice ?? p.sellingPrice,
    stockQty: v.stockQty,
    status: p.status,
    comment: p.comment,
    detail: p.detail,
  };
}

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

// 差分再計算: 全SKU×有効連携先の link を upsert し diff_status を確定
syncRouter.post("/recalculate", async (req, res, next) => {
  try {
    const { channelId } = z
      .object({ channelId: z.number().int().optional() })
      .parse(req.body ?? {});

    const channels = await prisma.channel.findMany({
      where: { active: true, ...(channelId && { id: channelId }) },
    });
    const variations = await prisma.productVariation.findMany({
      where: { product: { deletedAt: null } },
      include: { product: true },
    });

    let updated = 0;
    for (const channel of channels) {
      for (const v of variations) {
        const localPayload = buildLocalPayload(v);
        const localHash = hashPayload(localPayload);
        const existing = await prisma.productChannelLink.findUnique({
          where: { channelId_variationId: { channelId: channel.id, variationId: v.id } },
        });
        // 3層比較: local vs sent（remote はアダプタ fetchRemote 実装後に反映）
        let diffStatus: "NONE" | "UNREGISTERED" | "LOCAL_CHANGED" = "UNREGISTERED";
        if (existing?.linkStatus === "REGISTERED") {
          diffStatus = existing.sentHash === localHash ? "NONE" : "LOCAL_CHANGED";
        }
        await prisma.productChannelLink.upsert({
          where: { channelId_variationId: { channelId: channel.id, variationId: v.id } },
          create: {
            channelId: channel.id,
            productId: v.productId,
            variationId: v.id,
            localPayload,
            localHash,
            diffStatus,
          },
          update: { localPayload, localHash, diffStatus },
        });
        updated++;
      }
    }
    res.json({ channels: channels.length, links: updated });
  } catch (e) {
    next(e);
  }
});

// 連携状況一覧（diff_status ≠ NONE を既定で表示）— 共通設計 §6
syncRouter.get("/links", async (req, res, next) => {
  try {
    const q = z
      .object({
        channelId: z.coerce.number().int().optional(),
        diffStatus: z
          .enum(["NONE", "UNREGISTERED", "LOCAL_CHANGED", "REMOTE_DRIFT", "BOTH", "ALL"])
          .default("ALL"),
        page: z.coerce.number().int().min(1).default(1),
        perPage: z.coerce.number().int().min(1).max(200).default(50),
      })
      .parse(req.query);

    const where: Prisma.ProductChannelLinkWhereInput = {
      ...(q.channelId && { channelId: q.channelId }),
      ...(q.diffStatus === "ALL"
        ? { diffStatus: { not: "NONE" } }
        : { diffStatus: q.diffStatus }),
    };
    const [total, items] = await Promise.all([
      prisma.productChannelLink.count({ where }),
      prisma.productChannelLink.findMany({
        where,
        include: {
          channel: { select: { id: true, code: true, name: true } },
          product: { select: { id: true, productCode: true, name: true, updatedAt: true } },
          variation: { select: { id: true, skuCode: true, stockQty: true, price: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
    ]);
    res.json({ total, page: q.page, perPage: q.perPage, items });
  } catch (e) {
    next(e);
  }
});

// 反映（手動・選択分のみ）— 共通設計 §5
// アダプタ未実装のため、送信ジョブの作成〜sent スナップショット更新までを行う。
// 実送信は各アダプタ（futureshop CSV+FTP 等）を送信部に差し込む。
syncRouter.post("/reflect", async (req, res, next) => {
  try {
    const body = z
      .object({
        channelId: z.number().int(),
        linkIds: z.array(z.number().int()).min(1),
        jobType: z.enum(["PRODUCT", "PRICE", "STOCK", "IMAGE", "DELETE"]).default("PRODUCT"),
        triggeredBy: z.string().optional(),
      })
      .parse(req.body);

    const links = await prisma.productChannelLink.findMany({
      where: { id: { in: body.linkIds }, channelId: body.channelId },
      include: { product: true },
    });
    if (links.length === 0) return res.status(400).json({ error: "対象がありません" });

    const job = await prisma.syncJob.create({
      data: {
        channelId: body.channelId,
        jobType: body.jobType,
        triggeredBy: req.user?.name ?? body.triggeredBy ?? "web",
        rowCount: links.length,
        status: "CREATED",
        items: {
          create: links.map((link) => ({
            linkId: link.id,
            control:
              link.linkStatus === "UNREGISTERED"
                ? "N"
                : link.product.status === "DISCONTINUED"
                  ? "D"
                  : "U",
            payloadHash: link.localHash,
          })),
        },
      },
    });

    // TODO: アダプタ.send() をここに接続（futureshop: CSV生成→zip→FTP）
    // 現状は「送信済み」まで進め、awaitResult/fetchRemote はアダプタ実装後に対応
    for (const link of links) {
      await prisma.productChannelLink.update({
        where: { id: link.id },
        data: {
          sentPayload: link.localPayload ?? undefined,
          sentHash: link.localHash,
          linkStatus: "REGISTERED",
          syncStatus: "PENDING",
          lastSentAt: new Date(),
          diffStatus: "NONE",
        },
      });
    }
    await prisma.syncJob.update({
      where: { id: job.id },
      data: { status: "SENT", finishedAt: new Date() },
    });

    res.status(201).json({ jobId: job.id, rowCount: links.length });
  } catch (e) {
    next(e);
  }
});

// 反映履歴
syncRouter.get("/jobs", async (req, res, next) => {
  try {
    const q = z
      .object({
        channelId: z.coerce.number().int().optional(),
        page: z.coerce.number().int().min(1).default(1),
        perPage: z.coerce.number().int().min(1).max(100).default(30),
      })
      .parse(req.query);
    const where = q.channelId ? { channelId: q.channelId } : {};
    const [total, items] = await Promise.all([
      prisma.syncJob.count({ where }),
      prisma.syncJob.findMany({
        where,
        include: { channel: { select: { code: true, name: true } } },
        orderBy: { startedAt: "desc" },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
    ]);
    res.json({ total, page: q.page, perPage: q.perPage, items });
  } catch (e) {
    next(e);
  }
});
