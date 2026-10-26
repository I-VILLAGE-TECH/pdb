import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const makersRouter = Router();

makersRouter.get("/", async (_req, res, next) => {
  try {
    const makers = await prisma.maker.findMany({
      orderBy: [{ sortLevel: "asc" }, { makerCode: "asc" }],
      include: { _count: { select: { products: true } } },
    });
    res.json(makers);
  } catch (e) {
    next(e);
  }
});

const makerBody = z.object({
  makerCode: z.string().min(1),
  nameJp: z.string().min(1),
  nameEn: z.string().nullish(),
  imgFolder: z.string().nullish(),
  sortLevel: z.number().int().default(999),
  // シーリングファン(CF)用の表記(区分番号→表記)。空文字の区分は保存しない
  cfNotations: z
    .record(z.string().regex(/^\d+$/), z.string())
    .nullish()
    .transform((v) => (v ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== "")) : v)),
});

makersRouter.post("/", async (req, res, next) => {
  try {
    const { cfNotations, ...rest } = makerBody.parse(req.body);
    const maker = await prisma.maker.create({ data: { ...rest, cfNotations: cfNotations ?? Prisma.DbNull } });
    res.status(201).json(maker);
  } catch (e) {
    next(e);
  }
});

makersRouter.put("/:id", async (req, res, next) => {
  try {
    const maker = await prisma.maker.update({
      where: { id: Number(req.params.id) },
      data: (() => {
        const { cfNotations, ...rest } = makerBody.partial().parse(req.body);
        return cfNotations === undefined ? rest : { ...rest, cfNotations: cfNotations ?? Prisma.DbNull };
      })(),
    });
    res.json(maker);
  } catch (e) {
    next(e);
  }
});
