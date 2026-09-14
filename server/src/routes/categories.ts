import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export const categoriesRouter = Router();

categoriesRouter.get("/", async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { path: "asc" },
      include: { _count: { select: { products: true } } },
    });
    res.json(categories);
  } catch (e) {
    next(e);
  }
});

const categoryBody = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  parentId: z.number().int().nullish(),
});

categoriesRouter.post("/", async (req, res, next) => {
  try {
    const category = await prisma.category.create({ data: categoryBody.parse(req.body) });
    res.status(201).json(category);
  } catch (e) {
    next(e);
  }
});
