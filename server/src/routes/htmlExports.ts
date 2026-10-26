import { Router } from "express";
import { z } from "zod";
import { buildWhere, filterQuery } from "./exports.js";
import { forEachHtml, HTML_TYPES } from "../lib/html/index.js";
import { ZipStreamWriter } from "../lib/zipStream.js";

// /api/html-exports — 現行マクロの HTML 出力(ペンダントライト SPEC / シーリングファン 製品画像・SPEC)を ZIP でダウンロード
// 対象の絞り込みは CSV 出力と同じ(検索・カテゴリ・状態・メーカー・更新日・マーク付き)。channelId は不要
export const htmlExportsRouter = Router();

const typeEnum = z.enum(Object.keys(HTML_TYPES) as [keyof typeof HTML_TYPES, ...Array<keyof typeof HTML_TYPES>]);

htmlExportsRouter.get("/types", (_req, res) => {
  res.json(Object.entries(HTML_TYPES).map(([type, t]) => ({ type, label: t.label, book: t.book })));
});

// ZIP は商品を読みながら少しずつ書き出す(全件を一度に作ると Cloud Run のメモリ 512MiB を超えるため)。
// 件数は書き出し後でないと分からないので、データ不備は ZIP 内の errors.txt に入れる
htmlExportsRouter.post("/download", async (req, res, next) => {
  let zip: ZipStreamWriter | null = null;
  try {
    const { type } = z.object({ type: typeEnum }).parse(req.body);
    // 対象ブック(PL/CF)は種別で決まる(商品コード形式で判定)。画面のタブのカテゴリ条件は使わない
    // (PLブックにはその他別管理一覧FS=カテゴリOTHER や CF区分の商品も含まれ、現行マクロはそれらもSPECを出す)
    const { category: _c, categories: _cs, ...f } = filterQuery.parse({ ...req.body, channelId: 0 });
    const stamp = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace(/\D/g, "");
    const r = await forEachHtml(type, buildWhere(f), async (file) => {
      if (!zip) {
        // 最初のファイルができた時点でダウンロードを始める(対象が無ければ 400 を返せるように)
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${type}_${stamp}.zip"`);
        zip = new ZipStreamWriter(res);
      }
      await zip.add(`${file.folder}/${file.name}`, file.body, { deflate: true });
    });
    if (!zip) {
      return res.status(400).json({
        error: `出力対象がありません(登録フラグ対象外 ${r.skipped} 件${r.errors.length ? `、データ不備 ${r.errors.length} 件` : ""})`,
        errors: r.errors.slice(0, 100),
      });
    }
    const writer = zip as ZipStreamWriter;
    // 現行マクロなら停止するデータは出力せず、一覧をZIPに同梱する
    if (r.errors.length > 0) await writer.add("errors.txt", Buffer.from(`${r.errors.join("\r\n")}\r\n`), { deflate: true });
    await writer.finish();
    res.end();
  } catch (e) {
    if (zip) {
      console.error("html export failed:", e);
      res.destroy(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    next(e);
  }
});
