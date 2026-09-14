import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

type ImportJob = {
  id: string;
  fileName: string;
  bookType?: "PL" | "CF";
  mode: "diff" | "replace";
  status: "PARSING" | "RUNNING" | "DONE" | "ERROR";
  total: number;
  processed: number;
  created: number;
  updated: number;
  softDeleted: number;
  errors: string[];
  startedAt: string;
  finishedAt?: string;
  triggeredBy: string;
};

const STATUS_LABEL: Record<string, string> = {
  PARSING: "解析中",
  RUNNING: "取込中",
  DONE: "完了",
  ERROR: "エラー",
};

const MODE_LABEL: Record<string, string> = { diff: "差分更新", replace: "全入れ替え" };

type BulkImageResult = {
  fileName: string;
  matchedImages: number;
  matchedProducts: number;
  error?: string;
};

type ImagesSummary = { total: number; linked: number; unlinked: number };

export function ExcelImport() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"diff" | "replace">("diff");
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null);
  const [history, setHistory] = useState<ImportJob[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 画像一括アップロード
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageProgress, setImageProgress] = useState({ done: 0, total: 0 });
  const [imageResults, setImageResults] = useState<BulkImageResult[] | null>(null);
  const [imagesSummary, setImagesSummary] = useState<ImagesSummary | null>(null);

  const loadHistory = useCallback(() => {
    api<ImportJob[]>("/api/imports").then(setHistory).catch(() => {});
    api<ImagesSummary>("/api/imports/images/summary").then(setImagesSummary).catch(() => {});
  }, []);

  async function uploadImages(e: React.FormEvent) {
    e.preventDefault();
    if (imageFiles.length === 0) return;
    setImageBusy(true);
    setError("");
    setImageResults(null);
    setImageProgress({ done: 0, total: imageFiles.length });
    const all: BulkImageResult[] = [];
    try {
      // 20ファイルずつ分割アップロード
      for (let i = 0; i < imageFiles.length; i += 20) {
        const chunk = imageFiles.slice(i, i + 20);
        const form = new FormData();
        for (const f of chunk) form.append("files", f);
        const res = await fetch("/api/imports/images", {
          method: "POST",
          credentials: "same-origin",
          body: form,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { results: BulkImageResult[] };
        all.push(...data.results);
        setImageProgress({ done: Math.min(i + 20, imageFiles.length), total: imageFiles.length });
      }
      setImageResults(all);
      setImageFiles([]);
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setImageResults(all.length > 0 ? all : null);
    } finally {
      setImageBusy(false);
    }
  }

  useEffect(() => {
    loadHistory();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadHistory]);

  function poll(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const job = await api<ImportJob>(`/api/imports/${jobId}`);
        setCurrentJob(job);
        if (job.status === "DONE" || job.status === "ERROR") {
          if (pollRef.current) clearInterval(pollRef.current);
          loadHistory();
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 1500);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (
      mode === "replace" &&
      !confirm(
        "全入れ替えを実行します。\nファイルに含まれない同一種別の既存商品は削除（非表示）されます。よろしいですか？"
      )
    ) {
      return;
    }
    setUploading(true);
    setError("");
    setCurrentJob(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mode", mode);
      const res = await fetch("/api/imports", {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const job = (await res.json()) as ImportJob;
      setCurrentJob(job);
      poll(job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  const progress =
    currentJob && currentJob.total > 0
      ? Math.round((currentJob.processed / currentJob.total) * 100)
      : 0;

  return (
    <div>
      <h2>Excel取込</h2>
      <p className="muted">
        現行ブック（ペンダントライト一覧 .xlsm / シーリングファン一覧 .xlsb）をアップロードして商品データを取り込みます。ブック種別はシート名から自動判定します。
      </p>
      {error && <div className="error">{error}</div>}

      <form onSubmit={submit} className="panel">
        <div className="field">
          <label>Excelファイル（.xlsx / .xlsm / .xlsb）</label>
          <input
            type="file"
            accept=".xlsx,.xlsm,.xlsb"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="field">
          <label>取込モード</label>
          <label className="checkbox-filter" style={{ marginRight: 16 }}>
            <input
              type="radio"
              name="mode"
              checked={mode === "diff"}
              onChange={() => setMode("diff")}
            />
            差分更新（ファイルの商品を追加・更新。ファイルに無い既存商品はそのまま）
          </label>
          <label className="checkbox-filter">
            <input
              type="radio"
              name="mode"
              checked={mode === "replace"}
              onChange={() => setMode("replace")}
            />
            <span style={{ color: mode === "replace" ? "var(--danger)" : undefined }}>
              全入れ替え（取込後、同一種別でファイルに無い既存商品を削除＝非表示にする）
            </span>
          </label>
        </div>
        <button
          type="submit"
          className="primary"
          disabled={!file || uploading || currentJob?.status === "RUNNING" || currentJob?.status === "PARSING"}
        >
          {uploading ? "アップロード中…" : "取込を実行"}
        </button>
      </form>

      {currentJob && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>
            {currentJob.fileName}
            <span className="badge gray" style={{ marginLeft: 8 }}>
              {STATUS_LABEL[currentJob.status]}
            </span>
            {currentJob.bookType && (
              <span className="badge" style={{ marginLeft: 6 }}>
                {currentJob.bookType === "PL" ? "ペンダントライトブック" : "シーリングファンブック"}
              </span>
            )}
          </h3>
          {(currentJob.status === "RUNNING" || currentJob.status === "PARSING") && (
            <>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                {currentJob.processed.toLocaleString()} / {currentJob.total.toLocaleString()} 件（{progress}%）
              </div>
            </>
          )}
          {currentJob.status === "DONE" && (
            <div>
              取込完了: 新規 {currentJob.created.toLocaleString()} 件 / 更新{" "}
              {currentJob.updated.toLocaleString()} 件
              {currentJob.mode === "replace" && <> / 削除（非表示） {currentJob.softDeleted.toLocaleString()} 件</>}
              {currentJob.errors.length > 0 && <> / 失敗 {currentJob.errors.length} 件</>}
            </div>
          )}
          {currentJob.errors.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary className="error">エラー {currentJob.errors.length} 件</summary>
              <ul className="muted" style={{ maxHeight: 200, overflowY: "auto" }}>
                {currentJob.errors.slice(0, 100).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <h3>画像一括アップロード（ファイル名で紐付け）</h3>
      <p className="muted">
        Excel取込で登録された画像ファイル名（例: ivillage_if0160L-wh_M1.jpg）と同じ名前の画像を
        まとめてアップロードすると、一致する商品画像に自動で紐付きます（大文字小文字は無視）。
        同名画像を複数商品で共有している場合はすべてに紐付きます。
      </p>
      {imagesSummary && (
        <p className="muted">
          画像レコード {imagesSummary.total.toLocaleString()} 件中、紐付け済み{" "}
          {imagesSummary.linked.toLocaleString()} 件 ／ <b>未紐付け {imagesSummary.unlinked.toLocaleString()} 件</b>
        </p>
      )}
      <form onSubmit={uploadImages} className="panel">
        <div className="field">
          <label>画像ファイル（複数選択可・jpg/png/gif/webp/avif・1ファイル20MBまで）</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setImageFiles([...(e.target.files ?? [])])}
          />
        </div>
        {imageBusy && (
          <>
            <div className="progress-bar" style={{ marginBottom: 6 }}>
              <div
                className="progress-fill"
                style={{
                  width: `${imageProgress.total ? Math.round((imageProgress.done / imageProgress.total) * 100) : 0}%`,
                }}
              />
            </div>
            <div className="muted" style={{ marginBottom: 8 }}>
              {imageProgress.done} / {imageProgress.total} ファイル
            </div>
          </>
        )}
        <button type="submit" className="primary" disabled={imageFiles.length === 0 || imageBusy}>
          {imageBusy ? "アップロード中…" : `アップロードして紐付け（${imageFiles.length} ファイル）`}
        </button>
      </form>

      {imageResults && (
        <div className="panel">
          {(() => {
            const linked = imageResults.filter((r) => r.matchedImages > 0);
            const unmatched = imageResults.filter((r) => r.matchedImages === 0 && !r.error);
            const failed = imageResults.filter((r) => r.error);
            const totalRows = linked.reduce((a, r) => a + r.matchedImages, 0);
            return (
              <>
                <div>
                  紐付け完了: <b>{linked.length}</b> ファイル → 画像 {totalRows} 件（
                  {linked.reduce((a, r) => a + r.matchedProducts, 0)} 商品）
                  {unmatched.length > 0 && <> ／ 一致なし {unmatched.length} 件</>}
                  {failed.length > 0 && <> ／ 失敗 {failed.length} 件</>}
                </div>
                {unmatched.length > 0 && (
                  <details style={{ marginTop: 8 }}>
                    <summary className="muted">一致しなかったファイル（{unmatched.length}）</summary>
                    <ul className="muted" style={{ maxHeight: 200, overflowY: "auto" }}>
                      {unmatched.slice(0, 200).map((r) => (
                        <li key={r.fileName}>{r.fileName}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {failed.length > 0 && (
                  <details style={{ marginTop: 8 }}>
                    <summary className="error">失敗（{failed.length}）</summary>
                    <ul className="muted">
                      {failed.slice(0, 50).map((r) => (
                        <li key={r.fileName}>
                          {r.fileName}: {r.error}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            );
          })()}
        </div>
      )}

      <h3>取込履歴</h3>
      <table>
        <thead>
          <tr>
            <th>日時</th>
            <th>ファイル</th>
            <th>ブック</th>
            <th>モード</th>
            <th>結果</th>
            <th>実行者</th>
          </tr>
        </thead>
        <tbody>
          {history.map((j) => (
            <tr key={j.id}>
              <td className="muted">{new Date(j.startedAt).toLocaleString("ja-JP")}</td>
              <td>{j.fileName}</td>
              <td>{j.bookType ?? "-"}</td>
              <td>{MODE_LABEL[j.mode]}</td>
              <td>
                <span className={`badge ${j.status === "DONE" ? "green" : j.status === "ERROR" ? "red" : "gray"}`}>
                  {STATUS_LABEL[j.status]}
                </span>{" "}
                {j.status === "DONE" && (
                  <span className="muted">
                    新規{j.created}/更新{j.updated}
                    {j.mode === "replace" && `/削除${j.softDeleted}`}
                    {j.errors.length > 0 && `/失敗${j.errors.length}`}
                  </span>
                )}
              </td>
              <td>{j.triggeredBy}</td>
            </tr>
          ))}
          {history.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                まだ取込履歴はありません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
