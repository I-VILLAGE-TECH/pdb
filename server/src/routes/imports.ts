import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { requireAdmin } from "../lib/auth.js";
import { getJob, listJobs, startImportJob } from "../lib/importJobs.js";
import { prisma } from "../lib/prisma.js";
import { contentTypeFor, saveFile } from "../lib/storage.js";

// /api/imports — Excelブックからの取り込み（ADMINのみ。全入れ替えは破壊的操作のため）
export const importsRouter = Router();

importsRouter.use(requireAdmin);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

importsRouter.post("/", upload.single("file"), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "ファイルが指定されていません" });
    const { mode } = z.object({ mode: z.enum(["diff", "replace"]) }).parse(req.body);
    const fileName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    if (!/\.(xlsx|xlsm|xlsb)$/i.test(fileName)) {
      return res.status(400).json({ error: "Excelファイル（.xlsx / .xlsm / .xlsb）を指定してください" });
    }
    const job = startImportJob(fileName, req.file.buffer, mode, req.user!.name);
    res.status(202).json(job);
  } catch (e) {
    next(e);
  }
});

// 画像の一括アップロード＆ファイル名で紐付け
// Excel取込で登録済みの product_images.file_name と、アップロードしたファイル名を
// 突き合わせ（大文字小文字無視の完全一致）、一致した全行に url を設定する。
// 同名ファイルが複数商品で共有されている場合（バリエーション間の共用画像等）はすべてに紐付く。
const imagesUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 50 },
});

importsRouter.post("/images", imagesUpload.array("files", 50), async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) return res.status(400).json({ error: "ファイルが指定されていません" });

    const results: Array<{
      fileName: string;
      matchedImages: number;
      matchedProducts: number;
      error?: string;
    }> = [];

    for (const file of files) {
      const fileName = Buffer.from(file.originalname, "latin1").toString("utf8");
      const ext = path.extname(fileName).toLowerCase();
      if (![".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"].includes(ext)) {
        results.push({ fileName, matchedImages: 0, matchedProducts: 0, error: "対応していない形式" });
        continue;
      }
      try {
        const rows = await prisma.productImage.findMany({
          where: { fileName: { equals: fileName, mode: "insensitive" } },
          select: { id: true, productId: true },
        });
        if (rows.length === 0) {
          results.push({ fileName, matchedImages: 0, matchedProducts: 0 });
          continue;
        }
        const key = `images/bulk/${randomUUID()}${ext}`;
        await saveFile(key, file.buffer, contentTypeFor(fileName));
        await prisma.productImage.updateMany({
          where: { id: { in: rows.map((r) => r.id) } },
          data: { url: `/uploads/${key}` },
        });
        results.push({
          fileName,
          matchedImages: rows.length,
          matchedProducts: new Set(rows.map((r) => r.productId)).size,
        });
      } catch (e) {
        results.push({
          fileName,
          matchedImages: 0,
          matchedProducts: 0,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    res.json({ results });
  } catch (e) {
    next(e);
  }
});

// 紐付け状況のサマリ（何件の画像行がURL未設定か）
importsRouter.get("/images/summary", async (_req, res, next) => {
  try {
    const [total, linked] = await Promise.all([
      prisma.productImage.count(),
      prisma.productImage.count({ where: { url: { not: null } } }),
    ]);
    res.json({ total, linked, unlinked: total - linked });
  } catch (e) {
    next(e);
  }
});

importsRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await listJobs());
  } catch (e) {
    next(e);
  }
});

importsRouter.get("/:id", async (req, res, next) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ error: "ジョブが見つかりません" });
    res.json(job);
  } catch (e) {
    next(e);
  }
});
