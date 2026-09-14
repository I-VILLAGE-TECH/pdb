import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { productsRouter } from "./routes/products.js";
import { makersRouter } from "./routes/makers.js";
import { mastersRouter } from "./routes/masters.js";
import { settingsRouter } from "./routes/settings.js";
import { importsRouter } from "./routes/imports.js";
import { channelsRouter } from "./routes/channels.js";
import { categoriesRouter } from "./routes/categories.js";
import { syncRouter } from "./routes/sync.js";
import { exportsRouter } from "./routes/exports.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { requireAuth } from "./lib/auth.js";
import { contentTypeFor, streamFile } from "./lib/storage.js";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

app.get("/healthz", (_req, res) => res.json({ ok: true }));

// 認証不要（ログイン系のみ）
app.use("/api/auth", authRouter);

// 以降の /api は要ログイン
app.use("/api", requireAuth);
app.use("/api/users", usersRouter); // ルータ内で ADMIN 制限
app.use("/api/products", productsRouter);
app.use("/api/makers", makersRouter);
app.use("/api/masters", mastersRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/imports", importsRouter);
app.use("/api/channels", channelsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/sync", syncRouter);
app.use("/api/exports", exportsRouter);
app.use("/api/dashboard", dashboardRouter);

// アップロード画像の配信（ローカル/GCS共通。要ログイン）
app.get(/^\/uploads\/(.+)$/, requireAuth, (req, res) => {
  const key = (req.params as unknown as string[])[0];
  try {
    const stream = streamFile(key);
    if (!stream) return res.status(404).json({ error: "not found" });
    res.setHeader("Content-Type", contentTypeFor(key));
    res.setHeader("Cache-Control", "private, max-age=3600");
    stream.on("error", () => res.status(404).end());
    stream.pipe(res);
  } catch {
    res.status(400).json({ error: "invalid path" });
  }
});

// 本番: ビルド済みSPAを配信（web/dist を public/ にコピーして同梱）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
app.use(express.static(publicDir));
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) res.status(404).json({ error: "not found" });
  });
});

// エラーハンドラ
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    const message = err instanceof Error ? err.message : "internal error";
    res.status(500).json({ error: message });
  }
);

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`product-db server listening on :${port}`);
});
