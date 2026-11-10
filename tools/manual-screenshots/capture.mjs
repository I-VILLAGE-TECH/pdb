// 操作マニュアル(web/src/pages/Manual.tsx)用の画面キャプチャ。操作する場所に番号付きの赤枠を重ねて撮る
// 使い方は README.md。番号は Manual.tsx の <N n={…} /> と対応させる
import { chromium } from "playwright";
const B = process.env.BASE_URL ?? "http://localhost:5173";
const EMAIL = process.env.MANUAL_EMAIL ?? "admin@example.com";
const PASSWORD = process.env.MANUAL_PASSWORD ?? "admin1234";
const OUT = process.argv[2] ?? new URL("../../web/public/manual", import.meta.url).pathname;
const browser = await chromium.launch({ channel: "chromium", args: ["--lang=ja-JP"], env: { ...process.env, LANG: "ja_JP.UTF-8" } });
const page = await browser.newPage({ viewport: { width: 1400, height: 860 }, locale: "ja-JP" });
const M = page.locator("main");
const settle = async () => { await page.waitForLoadState("networkidle"); await page.waitForTimeout(900); };

async function boxOf(t) {
  const list = Array.isArray(t) ? t : [t];
  const bs = [];
  for (const l of list) { const b = await l.first().boundingBox(); if (!b) throw new Error("not found: " + l); bs.push(b); }
  const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
  const right = Math.min(Math.max(...bs.map((b) => b.x + b.width)), 1380); // 横スクロールで画面外に出る分は切る
  return { x, y, w: right - x, h: Math.max(...bs.map((b) => b.y + b.height)) - y };
}
async function mark(items) {
  const boxes = [];
  for (const [t, n, pos] of items) boxes.push({ ...(await boxOf(t)), n, pos: pos || "tl" });
  await page.evaluate((boxes) => {
    document.querySelectorAll(".mk").forEach((e) => e.remove());
    for (const b of boxes) {
      const sx = window.scrollX, sy = window.scrollY, P = 4;
      const f = document.createElement("div");
      f.className = "mk";
      Object.assign(f.style, { position: "absolute", left: b.x + sx - P + "px", top: b.y + sy - P + "px", width: b.w + P * 2 + "px", height: b.h + P * 2 + "px",
        border: "3px solid #e5484d", borderRadius: "8px", zIndex: 99999, pointerEvents: "none", boxSizing: "border-box" });
      const c = document.createElement("div");
      c.className = "mk";
      c.textContent = String(b.n);
      const left = b.pos === "tr" ? b.x + sx + b.w + P - 13 : b.pos === "in" ? b.x + sx + 8 : b.pos === "r" ? b.x + sx + b.w + P + 6 : b.x + sx - P - 13;
      const top = b.pos === "in" ? b.y + sy + 8 : b.pos === "r" ? b.y + sy + b.h / 2 - 13 : b.y + sy - P - 13;
      Object.assign(c.style, { position: "absolute", left: left + "px", top: top + "px", width: "26px", height: "26px", borderRadius: "50%",
        background: "#e5484d", color: "#fff", font: "700 15px/26px sans-serif", textAlign: "center", zIndex: 100000, pointerEvents: "none",
        boxShadow: "0 0 0 2px #fff" });
      document.body.append(c, f);
    }
  }, boxes);
}
async function shot(name, clip) {
  await page.screenshot({ path: `${OUT}/${name}.png`, clip, fullPage: true });
  await page.evaluate(() => document.querySelectorAll(".mk").forEach((e) => e.remove()));
}

// 仕入値は画像に残さない(マニュアルの画像はログインなしで配信されるため)
async function maskCost() {
  await page.evaluate(() => {
    const label = "仕入値(税抜)";
    // 詳細画面: 見出しセルの次のセル
    document.querySelectorAll("th, td").forEach((c) => {
      if (c.textContent.trim() === label && c.tagName === "TD" && c.nextElementSibling) c.nextElementSibling.textContent = "¥●,●●●";
    });
    // 表: 見出しの列番号の列
    document.querySelectorAll("table").forEach((t) => {
      const hs = [...t.querySelectorAll("thead th")];
      const i = hs.findIndex((h) => h.textContent.trim() === label);
      if (i < 0) return;
      t.querySelectorAll("tbody tr").forEach((tr) => { const c = tr.children[i]; if (c && c.textContent.trim()) c.textContent = "●●●●●"; });
    });
    // シート編集(react-data-grid): 見出しと同じ aria-colindex のセル
    document.querySelectorAll('[role="columnheader"]').forEach((h) => {
      if (h.textContent.trim() !== label) return;
      const ci = h.getAttribute("aria-colindex");
      document.querySelectorAll(`[role="gridcell"][aria-colindex="${ci}"]`).forEach((c) => { if (c.textContent.trim()) c.textContent = "●●●●●"; });
    });
  });
}

// ログイン
await page.goto(B + "/login");
await settle();
await page.screenshot({ path: `${OUT}/login.png`, clip: { x: 400, y: 150, width: 600, height: 520 } });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"));

// 画面の見かた
await page.goto(B + "/products/pendant"); await settle();
await mark([
  [page.locator("aside nav"), 1, "tr"],
  [page.getByText("パスワード変更"), 2, "r"],
  [page.locator("main"), 3, "in"],
]);
await shot("layout", { x: 0, y: 0, width: 1400, height: 860 });

// 商品一覧
await mark([
  [[M.getByRole("link", { name: "ペンダントライト", exact: true }), M.getByRole("link", { name: "シーリングファン", exact: true })], 1],
  [M.locator("thead tr").nth(1), 2],
  [M.locator("tbody tr").first().locator("td").first(), 3],
  [[M.getByText("★のみ"), M.getByText("件マーク中")], 4],
  [M.getByText(/表示項目/), 5],
  [M.getByRole("button", { name: "シート編集" }), 6],
  [M.getByRole("button", { name: /商品登録/ }), 7, "tr"],
]);
await shot("products", { x: 212, y: 0, width: 1188, height: 480 });

// 商品の詳細
const href = await M.locator("a", { hasText: "GE-0013E-PK" }).first().getAttribute("href");
await page.goto(B + href); await settle(); await maskCost();
await mark([
  [M.getByRole("button", { name: "編集", exact: true }).first(), 1],
  [M.getByRole("button", { name: /バリエーション追加/ }), 2],
  [M.locator("table input").first(), 3],
]);
await shot("product-detail", { x: 212, y: 0, width: 1188, height: 650 });

// シート編集
await page.goto(B + "/products/sheet"); await settle(); await maskCost();
await mark([
  [[M.getByPlaceholder("商品コード / 商品名 / 型番"), M.locator("select").nth(1)], 1],
  [M.getByRole("button", { name: /行追加/ }), 2],
  [M.getByRole("button", { name: /保存/ }), 3],
]);
await shot("sheet", { x: 212, y: 0, width: 1188, height: 300 });

// CSV出力(シーリングファン・futureshop を選んだ状態)
await page.goto(B + "/exports"); await settle();
await M.getByText("シーリングファン", { exact: true }).first().click();
await M.getByText("futureshop", { exact: true }).click();
await page.waitForTimeout(800);
const sels = M.locator("select");
await mark([
  [[M.getByText("ペンダントライト", { exact: true }).first(), M.getByText("シーリングファン", { exact: true }).first()], 1],
  [M.getByText("futureshop", { exact: true }).locator("xpath=ancestor::label[1]"), 2],
  [sels.filter({ has: page.locator("option", { hasText: "FS_ccGoods" }) }), 3],
  [[sels.filter({ has: page.locator("option", { hasText: "全ステータス" }) }), M.locator('input[type="date"]').last()], 4],
  [M.getByRole("button", { name: "プレビュー" }), 5],
  [M.getByRole("button", { name: "CSVダウンロード" }), 6, "tr"],
  [M.getByRole("button", { name: /HTMLをZIP/ }), 7, "tr"],
]);
await shot("exports", { x: 212, y: 92, width: 1188, height: 698 });

// 画像
await page.goto(B + "/images"); await settle();
await mark([
  [M.locator("summary").first(), 1],
  [M.locator('input[type="file"]'), 2],
  [M.getByRole("button", { name: /アップロード（/ }), 3, "tr"],
  [M.locator("select").first(), 4],
  [[M.locator("textarea"), M.getByText("生産終了品も含める")], 5],
  [M.getByRole("button", { name: "対象を確認" }), 6],
  [M.getByRole("button", { name: /ZIP をダウンロード/ }), 7, "tr"],
]);
await shot("images", { x: 212, y: 54, width: 1188, height: 770 });

// Excel取込
await page.goto(B + "/imports"); await settle();
await mark([
  [M.locator('input[type="file"]'), 1],
  [[M.getByText(/^差分更新/), M.getByText(/^全入れ替え/)], 2],
  [M.getByRole("button", { name: "取込を実行" }), 3],
  [M.getByRole("heading", { name: "取込履歴" }), 4],
]);
await shot("imports", { x: 212, y: 54, width: 1188, height: 520 });

// マスタ管理(メーカーの編集)
await page.goto(B + "/masters"); await settle();
await M.getByRole("button", { name: "編集" }).first().click(); await page.waitForTimeout(500);
await page.locator("summary", { hasText: "シーリングファン(CF)用の表記" }).click(); await page.waitForTimeout(400);
await mark([
  [page.locator("summary", { hasText: "シーリングファン(CF)用の表記" }), 1],
]);
await shot("masters", { x: 212, y: 0, width: 1188, height: 860 });

// ユーザー管理
await page.goto(B + "/users"); await settle();
await mark([
  [M.locator(".panel").first(), 1],
  [M.getByRole("button", { name: "PW再設定" }), 2],
  [M.getByRole("button", { name: "無効化" }), 3, "tr"],
]);
await shot("users", { x: 212, y: 54, width: 1188, height: 280 });

await browser.close();
