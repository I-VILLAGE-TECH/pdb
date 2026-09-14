import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export const channelsRouter = Router();

channelsRouter.get("/", async (_req, res, next) => {
  try {
    const channels = await prisma.channel.findMany({
      orderBy: { id: "asc" },
      include: {
        _count: { select: { productLinks: true, fieldMaps: true } },
      },
    });
    res.json(channels);
  } catch (e) {
    next(e);
  }
});

const channelBody = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  transferType: z.enum(["CSV", "API", "FTP"]),
  charset: z.enum(["SHIFT_JIS", "UTF8"]).optional(),
  stockSyncMode: z.enum(["QUANTITY", "AVAILABILITY", "NONE"]).optional(),
  priceSource: z.string().optional(),
  upsertMode: z.enum(["EXPLICIT_NUD", "PARTIAL_UPDATE", "FULL_REPLACE"]).optional(),
  splitRows: z.number().int().nullish(),
  active: z.boolean().optional(),
  reflectMode: z.enum(["MANUAL", "AUTO"]).optional(),
  verifySource: z.enum(["API_FETCH", "FEED_REPORT", "MAIL", "NONE"]).optional(),
  remoteFetchSchedule: z.string().nullish(),
  secretsRef: z.string().nullish(),
});

channelsRouter.post("/", async (req, res, next) => {
  try {
    const channel = await prisma.channel.create({ data: channelBody.parse(req.body) });
    res.status(201).json(channel);
  } catch (e) {
    next(e);
  }
});

channelsRouter.put("/:id", async (req, res, next) => {
  try {
    const channel = await prisma.channel.update({
      where: { id: Number(req.params.id) },
      data: channelBody.partial().parse(req.body),
    });
    res.json(channel);
  } catch (e) {
    next(e);
  }
});
