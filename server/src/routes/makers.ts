import { Router } from "express";
import { z } from "zod";
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
});

makersRouter.post("/", async (req, res, next) => {
  try {
    const maker = await prisma.maker.create({ data: makerBody.parse(req.body) });
    res.status(201).json(maker);
  } catch (e) {
    next(e);
  }
});

makersRouter.put("/:id", async (req, res, next) => {
  try {
    const maker = await prisma.maker.update({
      where: { id: Number(req.params.id) },
      data: makerBody.partial().parse(req.body),
    });
    res.json(maker);
  } catch (e) {
    next(e);
  }
});
