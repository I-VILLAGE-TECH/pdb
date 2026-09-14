import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../lib/auth.js";

// /api/users — ユーザー管理（ADMIN のみ）
export const usersRouter = Router();

usersRouter.use(requireAdmin);

const select = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

usersRouter.get("/", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({ select, orderBy: { id: "asc" } });
    res.json(users);
  } catch (e) {
    next(e);
  }
});

usersRouter.post("/", async (req, res, next) => {
  try {
    const body = z
      .object({
        email: z.string().email(),
        name: z.string().min(1),
        password: z.string().min(8),
        role: z.enum(["ADMIN", "EDITOR"]).default("EDITOR"),
      })
      .parse(req.body);
    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        role: body.role,
        passwordHash: await bcrypt.hash(body.password, 10),
      },
      select,
    });
    res.status(201).json(user);
  } catch (e) {
    next(e);
  }
});

usersRouter.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = z
      .object({
        name: z.string().min(1).optional(),
        role: z.enum(["ADMIN", "EDITOR"]).optional(),
        active: z.boolean().optional(),
      })
      .parse(req.body);
    // 自分自身の権限剥奪・無効化は禁止（管理者が誰もいなくなる事故防止）
    if (id === req.user!.id && (body.role === "EDITOR" || body.active === false)) {
      return res.status(400).json({ error: "自分自身の権限変更・無効化はできません" });
    }
    const user = await prisma.user.update({ where: { id }, data: body, select });
    // 無効化したらセッションも破棄
    if (body.active === false) {
      await prisma.session.deleteMany({ where: { userId: id } });
    }
    res.json(user);
  } catch (e) {
    next(e);
  }
});

// パスワードリセット（管理者が再設定）
usersRouter.post("/:id/reset-password", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { password } = z.object({ password: z.string().min(8) }).parse(req.body);
    await prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    await prisma.session.deleteMany({ where: { userId: id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
