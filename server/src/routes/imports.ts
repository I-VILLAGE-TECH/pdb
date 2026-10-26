import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAdmin } from "../lib/auth.js";
import {
  addMasterValues,
  getJob,
  listJobs,
  markMasterReviewed,
  startImportJob,
  withPendingReview,
} from "../lib/importJobs.js";

// /api/imports — Excelブックからの取り込み（ADMINのみ。全入れ替えは破壊的操作のため）
export const importsRouter = Router();

importsRouter.use(requireAdmin);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

importsRouter.post("/", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "ファイルが指定されていません" });
    const { mode } = z.object({ mode: z.enum(["diff", "replace"]) }).parse(req.body);
    const fileName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    if (!/\.(xlsx|xlsm|xlsb)$/i.test(fileName)) {
      return res.status(400).json({ error: "Excelファイル（.xlsx / .xlsm / .xlsb）を指定してください" });
    }
    const job = await startImportJob(fileName, req.file.buffer, mode, req.user!.name);
    res.status(202).json(job);
  } catch (e) {
    next(e);
  }
});

// 元画像のアップロードは /api/images(routes/images.ts)。商品画像の行は取込のたびに作り直すため、ここでは紐付けない

importsRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await withPendingReview(await listJobs()));
  } catch (e) {
    next(e);
  }
});

importsRouter.get("/:id", async (req, res, next) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ error: "ジョブが見つかりません" });
    res.json((await withPendingReview([job]))[0]);
  } catch (e) {
    next(e);
  }
});

// 取込後のマスタ確認: 選んだ値を汎用マスタに追加
importsRouter.post("/:id/masters", async (req, res, next) => {
  try {
    const { items } = z
      .object({ items: z.array(z.object({ type: z.string(), value: z.string().min(1) })).min(1) })
      .parse(req.body);
    const added = await addMasterValues(req.params.id, items);
    const job = await getJob(req.params.id);
    res.json({ added, job: job && (await withPendingReview([job]))[0] });
  } catch (e) {
    next(e);
  }
});

// 取込後のマスタ確認を「確認済み」にする
importsRouter.post("/:id/masters/reviewed", async (req, res, next) => {
  try {
    await markMasterReviewed(req.params.id, req.user!.name);
    const job = await getJob(req.params.id);
    res.json(job && (await withPendingReview([job]))[0]);
  } catch (e) {
    next(e);
  }
});
