import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", async (_req, res, next) => {
  try {
    const [byCategory, byStatus, makerCount, variationCount, pendingLinks, recentJobs] =
      await Promise.all([
        prisma.product.groupBy({
          by: ["category"],
          where: { deletedAt: null },
          _count: true,
        }),
        prisma.product.groupBy({
          by: ["status"],
          where: { deletedAt: null },
          _count: true,
        }),
        prisma.maker.count(),
        prisma.productVariation.count(),
        prisma.productChannelLink.count({ where: { diffStatus: { not: "NONE" } } }),
        prisma.syncJob.findMany({
          orderBy: { startedAt: "desc" },
          take: 5,
          include: { channel: { select: { name: true } } },
        }),
      ]);
    res.json({ byCategory, byStatus, makerCount, variationCount, pendingLinks, recentJobs });
  } catch (e) {
    next(e);
  }
});
