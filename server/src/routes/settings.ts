import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

// /api/settings — ログインユーザー自身の画面設定（key-value）
export const settingsRouter = Router();

const keySchema = z.string().min(1).max(100);

settingsRouter.get("/:key", async (req, res, next) => {
  try {
    const key = keySchema.parse(req.params.key);
    const setting = await prisma.userSetting.findUnique({
      where: { userId_key: { userId: req.user!.id, key } },
    });
    res.json({ key, value: setting?.value ?? null });
  } catch (e) {
    next(e);
  }
});

settingsRouter.put("/:key", async (req, res, next) => {
  try {
    const key = keySchema.parse(req.params.key);
    const { value } = z.object({ value: z.unknown() }).parse(req.body);
    const setting = await prisma.userSetting.upsert({
      where: { userId_key: { userId: req.user!.id, key } },
      create: { userId: req.user!.id, key, value: value as object },
      update: { value: value as object },
    });
    res.json({ key, value: setting.value });
  } catch (e) {
    next(e);
  }
});

// 既定に戻す
settingsRouter.delete("/:key", async (req, res, next) => {
  try {
    const key = keySchema.parse(req.params.key);
    await prisma.userSetting.deleteMany({ where: { userId: req.user!.id, key } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
