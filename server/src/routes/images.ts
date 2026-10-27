import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { z } from "zod";
import { requireAdmin } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { contentTypeFor, streamFile } from "../lib/storage.js";
import {
  isImageFileName,
  loadReferencedImages,
  loadStoredImages,
  saveUploadedImage,
} from "../lib/imageAssets.js";
import { IMAGE_OUTPUT_KINDS, planImageOutput, type ImageOutputKind } from "../lib/imageOutputs.js";
import { ZipStreamWriter } from "../lib/zipStream.js";

// /api/images — 元画像のアップロード(フォルダ単位の同期)と、画像ファイルの出力(ZIP)
export const imagesRouter = Router();

// 状況: 商品で使われている画像のうち、アップロード済み・未アップロードの件数
imagesRouter.get("/summary", async (_req, res, next) => {
  try {
    const [referenced, stored] = await Promise.all([loadReferencedImages(), loadStoredImages()]);
    let uploaded = 0;
    for (const key of referenced.keys()) if (stored.has(key)) uploaded++;
    res.json({ referenced: referenced.size, uploaded, missing: referenced.size - uploaded, stored: stored.size });
  } catch (e) {
    next(e);
  }
});

// 未アップロードの画像一覧(使っている商品コードつき)。format=csv でダウンロード
imagesRouter.get("/missing", async (req, res, next) => {
  try {
    const { format } = z.object({ format: z.enum(["json", "csv"]).default("json") }).parse(req.query);
    const [referenced, stored] = await Promise.all([loadReferencedImages(), loadStoredImages()]);
    const rows = [...referenced.entries()]
      .filter(([key]) => !stored.has(key))
      .map(([, v]) => ({ fileName: v.fileName, productCodes: v.productCodes }))
      .sort((a, b) => a.fileName.localeCompare(b.fileName));
    if (format === "csv") {
      const body = ["ファイル名,使っている商品", ...rows.map((r) => `"${r.fileName}","${r.productCodes.join(" ")}"`)].join("\r\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent("未アップロード画像.csv")}`);
      return res.send("\uFEFF" + body + "\r\n");
    }
    res.json({ total: rows.length, items: rows.slice(0, 500) });
  } catch (e) {
    next(e);
  }
});

// アップロード前の照合: 選んだフォルダのファイル(名前・サイズ)のうち、送る必要があるものを返す
imagesRouter.post("/check", requireAdmin, async (req, res, next) => {
  try {
    const { files } = z
      .object({ files: z.array(z.object({ name: z.string().min(1), size: z.number().int().nonnegative() })).max(20000) })
      .parse(req.body);
    const [referenced, stored] = await Promise.all([loadReferencedImages(), loadStoredImages()]);
    res.json(
      files.map((f) => {
        const key = f.name.toLowerCase();
        const s = stored.get(key);
        return {
          name: f.name,
          referenced: referenced.has(key),
          status: !s ? "new" : s.byteSize === f.size ? "same" : "changed",
        };
      })
    );
  } catch (e) {
    next(e);
  }
});

// 元画像のアップロード(1回20ファイルまで。画面が分割して送る)。paths はフォルダ内の相対パス(files と同じ順)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 20 } });

imagesRouter.post("/upload", requireAdmin, upload.array("files", 20), async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) return res.status(400).json({ error: "ファイルが指定されていません" });
    const paths = z.array(z.string()).catch([]).parse(JSON.parse(String(req.body.paths ?? "[]")));
    const results: Array<{ fileName: string; ok: boolean; width?: number; height?: number; error?: string }> = [];
    for (const [i, file] of files.entries()) {
      const fileName = Buffer.from(file.originalname, "latin1").toString("utf8");
      if (!isImageFileName(fileName)) {
        results.push({ fileName, ok: false, error: "対応していない形式" });
        continue;
      }
      try {
        const size = await saveUploadedImage(fileName, file.buffer, paths[i] ?? null);
        results.push({ fileName, ok: true, ...size });
      } catch (e) {
        results.push({ fileName, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    res.json({ results });
  } catch (e) {
    next(e);
  }
});

// 元画像の表示(商品詳細のサムネイル等)
imagesRouter.get("/file/:name", async (req, res, next) => {
  try {
    const row = await prisma.imageFile.findFirst({
      where: { fileName: { equals: req.params.name, mode: "insensitive" }, storageKey: { not: null } },
    });
    const stream = row?.storageKey ? streamFile(row.storageKey) : null;
    if (!stream) return res.status(404).json({ error: "画像がありません" });
    res.setHeader("Content-Type", contentTypeFor(row!.fileName));
    res.setHeader("Cache-Control", "private, max-age=3600");
    stream.on("error", () => res.status(404).end());
    stream.pipe(res);
  } catch (e) {
    next(e);
  }
});

const outputBody = z.object({
  kind: z.enum(Object.keys(IMAGE_OUTPUT_KINDS) as [ImageOutputKind, ...ImageOutputKind[]]),
  productCodes: z.array(z.string().min(1)).max(20000).optional(),
  q: z.string().optional(),
  makerId: z.number().int().optional(),
  updatedFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  updatedTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  includeDiscontinued: z.boolean().optional(),
});

imagesRouter.get("/output-kinds", (_req, res) => {
  res.json(Object.entries(IMAGE_OUTPUT_KINDS).map(([kind, v]) => ({ kind, ...v })));
});

// 出力前の確認: 対象商品数・ファイル数・不足している元画像
imagesRouter.post("/output/preview", async (req, res, next) => {
  try {
    const { kind, ...filter } = outputBody.parse(req.body);
    const stored = await loadStoredImages();
    const plan = await planImageOutput(kind, filter, new Set(stored.keys()));
    res.json({ products: plan.products, files: plan.entries.length, issues: plan.issues.slice(0, 300), issueCount: plan.issues.length });
  } catch (e) {
    next(e);
  }
});

// 画像ファイルを ZIP でダウンロード(フォルダ構成は現行マクロの出力先に合わせる)。不足一覧は ZIP 内の _result.txt
imagesRouter.post("/output/download", async (req, res, next) => {
  let started = false;
  try {
    const { kind, ...filter } = outputBody.parse(req.body);
    const stored = await loadStoredImages();
    const plan = await planImageOutput(kind, filter, new Set(stored.keys()));
    if (plan.entries.length === 0) {
      return res.status(400).json({ error: "出力できる画像がありません(元画像が未アップロードか、対象商品がありません)" });
    }
    const stamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" }).replace(/\D/g, "").slice(0, 12);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(`画像_${kind}_${stamp}.zip`)}`);
    started = true;
    const zip = new ZipStreamWriter(res);
    const written = new Set<string>();
    for (const e of plan.entries) {
      if (written.has(e.path)) continue; // 同じ出力名は最初の1件(現行の「出力先に既にあれば上書きしない」に相当)
      written.add(e.path);
      const src = stored.get(e.source.toLowerCase())!;
      if (e.resize) {
        const chunks: Buffer[] = [];
        for await (const c of streamFile(src.storageKey)!) chunks.push(c as Buffer);
        const resized = await sharp(Buffer.concat(chunks))
          .resize(e.resize.width, e.resize.height, { fit: "inside" })
          .jpeg({ quality: 90 })
          .toBuffer();
        await zip.add(e.path, resized);
      } else {
        const stream = streamFile(src.storageKey);
        if (!stream) continue;
        await zip.add(e.path, stream);
      }
    }
    const report = [
      `${IMAGE_OUTPUT_KINDS[kind].label}`,
      `対象商品 ${plan.products} 件 / 出力 ${written.size} ファイル / 注意 ${plan.issues.length} 件`,
      "",
      ...plan.issues.map((i) => `${i.productCode}\t${i.fileName}\t${i.reason}`),
    ].join("\r\n");
    await zip.add("_result.txt", Buffer.from("\uFEFF" + report + "\r\n", "utf8"));
    await zip.finish();
    // 楽天の画像リネーム: 出力した画像を画像管理に登録する(ZIP を書き終えてから)
    await plan.commit?.();
    res.end();
  } catch (e) {
    if (started) {
      console.error("image output failed:", e);
      res.destroy(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    next(e);
  }
});

