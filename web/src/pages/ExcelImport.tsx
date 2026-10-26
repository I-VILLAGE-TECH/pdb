import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { LoadingStatus, ProgressBar, Spinner } from "../components/Loading";
import { MASTER_TYPE_LABEL } from "./Masters";

// 取込後のマスタ確認(server/src/lib/importJobs.ts MasterReview)。values は未登録のまま残っている値だけ
type MasterReview = {
  values: Array<{ type: string; value: string; count: number; samples: string[] }>;
  newMakers: Array<{ id: number; makerCode: string; nameJp: string }>;
  reviewedAt?: string;
  reviewedBy?: string;
};

type ImportJob = {
  id: string;
  fileName: string;
  bookType?: "PL" | "CF";
  mode: "diff" | "replace";
  status: "QUEUED" | "PARSING" | "RUNNING" | "DONE" | "ERROR";
  total: number;
  processed: number;
  created: number;
  updated: number;
  softDeleted: number;
  errors: string[];
  startedAt: string;
  finishedAt?: string;
  triggeredBy: string;
  masterReview?: MasterReview;
};

// 確認が必要か(未登録の値か新しいメーカーがあり、まだ「確認済み」にしていない)
function needsMasterReview(j: ImportJob): boolean {
  const r = j.masterReview;
  return !!r && !r.reviewedAt && (r.values.length > 0 || r.newMakers.length > 0);
}

// 取込後のマスタ確認: 取り込んだ商品にあってマスタに無い値を、選んで汎用マスタに追加する。
// 取込そのものはマスタを変えない(新しいメーカーだけは商品の紐付けに必要なため取込時に作る)
function MasterReviewPanel({ job, onUpdated }: { job: ImportJob; onUpdated: (j: ImportJob) => void }) {
  const review = job.masterReview!;
  const key = (v: { type: string; value: string }) => `${v.type}\t${v.value}`;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function toggle(k: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function addSelected() {
    const items = review.values
      .filter((v) => selected.has(key(v)))
      .map((v) => ({ type: v.type, value: v.value }));
    if (items.length === 0) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await api<{ added: number; job: ImportJob }>(`/api/imports/${job.id}/masters`, {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      setSelected(new Set());
      setMessage(`${res.added} 件をマスタに追加しました`);
      onUpdated(res.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function markReviewed() {
    const rest = review.values.length;
    if (rest > 0 && !confirm(`残りの ${rest} 件はマスタに追加せずに確認済みにします。よろしいですか？`)) return;
    setBusy(true);
    setError("");
    try {
      onUpdated(await api<ImportJob>(`/api/imports/${job.id}/masters/reviewed`, { method: "POST" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (review.values.length === 0 && review.newMakers.length === 0) {
    return <div className="muted" style={{ marginTop: 8 }}>マスタ確認: マスタに無い値はありませんでした</div>;
  }

  const allSelected = review.values.length > 0 && review.values.every((v) => selected.has(key(v)));
  return (
    <div style={{ marginTop: 12 }}>
      <h4 style={{ margin: "0 0 4px" }}>
        マスタ確認
        {review.reviewedAt ? (
          <span className="badge green" style={{ marginLeft: 8 }}>
            確認済み（{new Date(review.reviewedAt).toLocaleString("ja-JP")} {review.reviewedBy}）
          </span>
        ) : (
          <span className="badge amber" style={{ marginLeft: 8 }}>未確認</span>
        )}
      </h4>
      {error && <div className="error">{error}</div>}
      {message && <div style={{ color: "#166534", padding: "4px 0" }}>{message}</div>}

      {review.newMakers.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div>
            この取込で新しく作ったメーカー（{review.newMakers.length} 件）。名称や CF 用の表記を{" "}
            <Link to="/masters">マスタ管理</Link> のメーカーで確認してください。
          </div>
          <ul className="muted" style={{ margin: "4px 0" }}>
            {review.newMakers.map((m) => (
              <li key={m.id}>
                {m.makerCode} {m.nameJp}
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.values.length > 0 && (
        <>
          <div className="muted" style={{ marginBottom: 6 }}>
            取り込んだ商品にあって、マスタ（商品登録・編集の選択肢）に無い値です。追加するものを選んでください。
            追加しなくても取り込んだ商品の値はそのまま使えます。
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(review.values.map(key)))}
                    aria-label="すべて選択"
                  />
                </th>
                <th>マスタ</th>
                <th>値</th>
                <th>商品数</th>
                <th>例</th>
              </tr>
            </thead>
            <tbody>
              {review.values.map((v) => (
                <tr key={key(v)} onClick={() => toggle(key(v))} style={{ cursor: "pointer" }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(key(v))}
                      onChange={() => toggle(key(v))}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td>{MASTER_TYPE_LABEL[v.type] ?? v.type}</td>
                  <td>{v.value}</td>
                  <td>{v.count.toLocaleString()}</td>
                  <td className="muted">{v.samples.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="toolbar" style={{ marginTop: 8, marginBottom: 0 }}>
        {review.values.length > 0 && (
          <button type="button" className="primary" disabled={busy || selected.size === 0} onClick={addSelected}>
            {busy ? <Spinner /> : null}
            選択した {selected.size} 件をマスタに追加
          </button>
        )}
        {!review.reviewedAt && (
          <button type="button" disabled={busy} onClick={markReviewed}>
            確認済みにする
          </button>
        )}
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  QUEUED: "起動待ち", // GCPでは取込用のCloud Runジョブの起動に数十秒かかる
  PARSING: "解析中",
  RUNNING: "取込中",
  DONE: "完了",
  ERROR: "エラー",
};

const MODE_LABEL: Record<string, string> = { diff: "差分更新", replace: "全入れ替え" };

export function ExcelImport() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"diff" | "replace">("diff");
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null);
  const [history, setHistory] = useState<ImportJob[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStartedAt, setUploadStartedAt] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHistory = useCallback(() => {
    api<ImportJob[]>("/api/imports").then(setHistory).catch(() => {});
  }, []);

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
    setUploadStartedAt(Date.now());
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
      setUploadStartedAt(null);
    }
  }

  // 取込履歴からマスタ確認を開く(結果パネルは画面上部にある)
  function openJob(j: ImportJob) {
    setCurrentJob(j);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
          disabled={
            !file ||
            uploading ||
            currentJob?.status === "QUEUED" ||
            currentJob?.status === "RUNNING" ||
            currentJob?.status === "PARSING"
          }
        >
          {uploading ? (
            <>
              <Spinner />
              アップロード中…
            </>
          ) : (
            "取込を実行"
          )}
        </button>
        {uploading && (
          <LoadingStatus
            message="ブックをアップロードしています"
            startedAt={uploadStartedAt}
            note="ファイルが大きいと数十秒かかることがあります。画面を閉じずにお待ちください"
          />
        )}
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
          {(currentJob.status === "QUEUED" || currentJob.status === "RUNNING" || currentJob.status === "PARSING") && (
            <>
              {/* 件数が分かるまで(起動待ち・解析中)は流れるバー、取込中は%に縞模様を重ねて動きを見せる */}
              <ProgressBar percent={currentJob.status === "RUNNING" && currentJob.total > 0 ? progress : null} />
              <LoadingStatus
                message={
                  currentJob.status === "QUEUED"
                    ? "取込処理を起動しています"
                    : currentJob.status === "PARSING"
                      ? "ブックを解析しています"
                      : `取込中 ${currentJob.processed.toLocaleString()} / ${currentJob.total.toLocaleString()} 件（${progress}%）`
                }
                startedAt={currentJob.startedAt}
                note={
                  currentJob.status === "QUEUED"
                    ? "起動に数十秒かかることがあります"
                    : currentJob.status === "PARSING"
                      ? "ブックの大きさにより1分程度かかります"
                      : "全件で数分かかります。この画面を閉じても取込は続きます"
                }
              />
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
          {currentJob.status === "DONE" && currentJob.masterReview && (
            <MasterReviewPanel
              key={currentJob.id}
              job={currentJob}
              onUpdated={(j) => {
                setCurrentJob(j);
                loadHistory();
              }}
            />
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

      <p className="muted">
        商品画像の元ファイルは <Link to="/images">画像</Link> 画面でフォルダごとアップロードします（Excel取込をやり直しても消えません）。
      </p>

      <h3>取込履歴</h3>
      <table>
        <thead>
          <tr>
            <th>日時</th>
            <th>ファイル</th>
            <th>ブック</th>
            <th>モード</th>
            <th>結果</th>
            <th>マスタ確認</th>
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
              <td>
                {needsMasterReview(j) ? (
                  <button
                    type="button"
                    className="badge amber"
                    onClick={() => openJob(j)}
                    style={{ cursor: "pointer", border: 0 }}
                  >
                    未確認 {j.masterReview!.values.length + j.masterReview!.newMakers.length} 件
                  </button>
                ) : j.masterReview?.reviewedAt ? (
                  <button
                    type="button"
                    className="badge green"
                    onClick={() => openJob(j)}
                    style={{ cursor: "pointer", border: 0 }}
                  >
                    確認済み
                  </button>
                ) : (
                  <span className="muted">-</span>
                )}
              </td>
              <td>{j.triggeredBy}</td>
            </tr>
          ))}
          {history.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                まだ取込履歴はありません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
