import type { NextFunction, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { prisma } from "./prisma.js";
import type { User } from "@prisma/client";

const SESSION_COOKIE = "sid";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7日

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

export async function createSession(res: Response, userId: number): Promise<void> {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id, userId, expiresAt } });
  res.cookie(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    // ローカルDocker(http)でも動くよう NODE_ENV ではなく明示フラグで制御（Cloud Run では true）
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export async function destroySession(req: Request, res: Response): Promise<void> {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (sid) {
    await prisma.session.deleteMany({ where: { id: sid } });
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** cookie のセッションを検証し req.user を設定（無効なら 401） */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const sid = req.cookies?.[SESSION_COOKIE];
    if (!sid) return res.status(401).json({ error: "ログインが必要です" });
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date() || !session.user.active) {
      if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      res.clearCookie(SESSION_COOKIE, { path: "/" });
      return res.status(401).json({ error: "セッションが無効です" });
    }
    req.user = session.user;
    next();
  } catch (e) {
    next(e);
  }
}

/** ADMIN のみ許可（requireAuth の後段で使用） */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "管理者権限が必要です" });
  }
  next();
}
