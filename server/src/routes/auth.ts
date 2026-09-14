import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { createSession, destroySession, requireAuth } from "../lib/auth.js";

export const authRouter = Router();

function publicUser(u: { id: number; email: string; name: string; role: string; lastLoginAt: Date | null }) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, lastLoginAt: u.lastLoginAt };
}

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // ユーザー有無を悟らせないため同一メッセージ
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "メールアドレスまたはパスワードが違います" });
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await createSession(res, user.id);
    res.json(publicUser(user));
  } catch (e) {
    next(e);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    await destroySession(req, res);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json(publicUser(req.user!));
});

// 自分のパスワード変更
authRouter.put("/password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = z
      .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) })
      .parse(req.body);
    const user = req.user!;
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(400).json({ error: "現在のパスワードが違います" });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
