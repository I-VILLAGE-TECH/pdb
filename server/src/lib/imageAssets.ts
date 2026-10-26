// 元画像の保管(画像管理画面からフォルダごとアップロード)
// - ファイル名単位で image_files に保存先を記録する。商品の画像(product_images)は Excel 取込のたびに作り直されるため、
//   紐付けは持たず、出力・表示のたびにファイル名で引き当てる(大文字小文字は区別しない。現行のWindowsと同じ)
// - 幅・高さはアップロード時に実ファイルから計測して image_files に入れる(futureshop CSV の画像サイズに使われる)
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "./prisma.js";
import { contentTypeFor, saveFile } from "./storage.js";

export const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

export function isImageFileName(name: string): boolean {
  return IMAGE_EXTS.includes(path.extname(name).toLowerCase());
}

// ファイル名に日本語・記号が入っていても安全なキーにする(同じ名前は大文字小文字を問わず同じキー)
function storageKeyFor(fileName: string): string {
  const hash = createHash("sha1").update(fileName.toLowerCase()).digest("hex");
  return `images/files/${hash}${path.extname(fileName).toLowerCase()}`;
}

export function imageFileUrl(fileName: string): string {
  return `/api/images/file/${encodeURIComponent(fileName)}`;
}

export type StoredImage = { fileName: string; storageKey: string; byteSize: number | null };

/** 保管済みの元画像をファイル名(小文字)で引けるようにする */
export async function loadStoredImages(): Promise<Map<string, StoredImage>> {
  const rows = await prisma.imageFile.findMany({
    where: { storageKey: { not: null } },
    select: { fileName: true, storageKey: true, byteSize: true },
  });
  return new Map(rows.map((r) => [r.fileName.toLowerCase(), r as StoredImage]));
}

/** 商品で使われている画像のファイル名(小文字 → 使っている商品コード) */
export async function loadReferencedImages(): Promise<Map<string, { fileName: string; productCodes: string[] }>> {
  const rows = await prisma.productImage.findMany({
    where: { product: { deletedAt: null } },
    select: { fileName: true, product: { select: { productCode: true } } },
  });
  // PLは行(SKU)ごとの画像も使う(Yahoo画像。excelExtract の extra.plRowImages)
  const rowImages = await prisma.$queryRaw<Array<{ product_code: string; images: Record<string, string[]> }>>`
    select product_code, extra->'plRowImages' as images from products
    where deleted_at is null and extra ? 'plRowImages'`;
  const map = new Map<string, { fileName: string; productCodes: string[] }>();
  const add = (fileName: string, productCode: string) => {
    if (!isImageFileName(fileName)) return; // CUSTOM-SIZE などの指定値を除く
    const key = fileName.toLowerCase();
    const v = map.get(key) ?? { fileName, productCodes: [] };
    if (!v.productCodes.includes(productCode)) v.productCodes.push(productCode);
    map.set(key, v);
  };
  for (const r of rows) add(r.fileName, r.product.productCode);
  for (const r of rowImages) for (const names of Object.values(r.images ?? {})) for (const n of names) add(n, r.product_code);
  return map;
}

/** アップロードされた元画像を保存し、image_files を更新する */
export async function saveUploadedImage(
  fileName: string,
  buffer: Buffer,
  sourcePath: string | null
): Promise<{ width: number; height: number }> {
  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height) throw new Error("画像として読み込めませんでした");
  const storageKey = storageKeyFor(fileName);
  await saveFile(storageKey, buffer, contentTypeFor(fileName));
  const data = {
    width: meta.width,
    height: meta.height,
    storageKey,
    byteSize: buffer.length,
    sourcePath,
    uploadedAt: new Date(),
  };
  // 既存の行(Excel・正解CSVから入れた画像サイズ)は名前の大文字小文字が違っても同じ画像として更新する
  const existing = await prisma.imageFile.findFirst({
    where: { fileName: { equals: fileName, mode: "insensitive" } },
  });
  if (existing) await prisma.imageFile.update({ where: { fileName: existing.fileName }, data });
  else await prisma.imageFile.create({ data: { fileName, ...data } });
  return { width: meta.width, height: meta.height };
}

/** 商品詳細の画像一覧に表示用URLを補う(個別アップロードのURLが無いものは元画像で表示) */
export async function withImageUrls<T extends { fileName: string; url: string | null }>(
  images: T[]
): Promise<Array<T & { url: string | null }>> {
  const names = images.filter((i) => !i.url).map((i) => i.fileName);
  if (names.length === 0) return images;
  const stored = await prisma.imageFile.findMany({
    where: { storageKey: { not: null }, OR: names.map((n) => ({ fileName: { equals: n, mode: "insensitive" as const } })) },
    select: { fileName: true },
  });
  const has = new Set(stored.map((s) => s.fileName.toLowerCase()));
  return images.map((i) => (!i.url && has.has(i.fileName.toLowerCase()) ? { ...i, url: imageFileUrl(i.fileName) } : i));
}
