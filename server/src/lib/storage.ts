// 画像ファイルの保存先抽象化
// ローカル/Docker: UPLOADS_DIR（既定 ./uploads）に保存
// 本番(GCP): GCS_BUCKET が設定されていれば Google Cloud Storage に保存
// 配信はどちらも GET /uploads/<key> でアプリ経由（認証つき）
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import { Storage } from "@google-cloud/storage";

const bucketName = process.env.GCS_BUCKET;
const localRoot = path.resolve(process.env.UPLOADS_DIR ?? "uploads");

const gcs = bucketName ? new Storage() : null;

// キーはサニタイズ済み前提（呼び出し側で生成）。念のためパストラバーサルを拒否
function assertSafeKey(key: string): void {
  if (key.includes("..") || key.startsWith("/")) throw new Error("invalid storage key");
}

export async function saveFile(key: string, buffer: Buffer, contentType: string): Promise<void> {
  assertSafeKey(key);
  if (gcs && bucketName) {
    await gcs.bucket(bucketName).file(key).save(buffer, { contentType });
    return;
  }
  const filePath = path.join(localRoot, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
}

export function streamFile(key: string): Readable | null {
  assertSafeKey(key);
  if (gcs && bucketName) {
    return gcs.bucket(bucketName).file(key).createReadStream();
  }
  const filePath = path.join(localRoot, key);
  if (!existsSync(filePath)) return null;
  return createReadStream(filePath);
}

export async function removeFile(key: string): Promise<void> {
  assertSafeKey(key);
  try {
    if (gcs && bucketName) {
      await gcs.bucket(bucketName).file(key).delete({ ignoreNotFound: true });
    } else {
      await unlink(path.join(localRoot, key));
    }
  } catch {
    // ファイル実体の削除失敗は致命的でない（DB行の削除を優先）
  }
}

export function contentTypeFor(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return (
    {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".avif": "image/avif",
    }[ext] ?? "application/octet-stream"
  );
}
