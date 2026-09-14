import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

// /api/masters — 汎用コードマスタ（仕入先・取付タイプ・口金・電球色 等）
export const mastersRouter = Router();

export const MASTER_TYPES = [
  "supplier",
  "installation_type",
  "bulb_base",
  "bulb_color",
  "light_color",
  "body_color",
  "material",
  "warranty",
  "motor_type",
] as const;

const typeEnum = z.enum(MASTER_TYPES);

// 種別ごとの件数
mastersRouter.get("/types", async (_req, res, next) => {
  try {
    const counts = await prisma.masterItem.groupBy({ by: ["type"], _count: true });
    res.json(
      MASTER_TYPES.map((t) => ({
        type: t,
        count: counts.find((c) => c.type === t)?._count ?? 0,
      }))
    );
  } catch (e) {
    next(e);
  }
});

// type 省略時は全種別を返す（マスタ管理画面はテーブル別に一覧表示するため一括取得）
mastersRouter.get("/", async (req, res, next) => {
  try {
    const { type, activeOnly } = z
      .object({
        type: typeEnum.optional(),
        activeOnly: z.enum(["1"]).optional(),
      })
      .parse(req.query);
    const items = await prisma.masterItem.findMany({
      where: { ...(type && { type }), ...(activeOnly && { active: true }) },
      orderBy: [{ type: "asc" }, { sortNo: "asc" }, { value: "asc" }],
    });
    res.json(items);
  } catch (e) {
    next(e);
  }
});

mastersRouter.post("/", async (req, res, next) => {
  try {
    const body = z
      .object({
        type: typeEnum,
        value: z.string().min(1),
        sortNo: z.number().int().optional(),
        note: z.string().nullish(),
      })
      .parse(req.body);
    const item = await prisma.masterItem.create({ data: body });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

mastersRouter.put("/:id", async (req, res, next) => {
  try {
    const body = z
      .object({
        value: z.string().min(1).optional(),
        sortNo: z.number().int().optional(),
        active: z.boolean().optional(),
        note: z.string().nullish(),
      })
      .parse(req.body);
    const item = await prisma.masterItem.update({
      where: { id: Number(req.params.id) },
      data: body,
    });
    res.json(item);
  } catch (e) {
    next(e);
  }
});
