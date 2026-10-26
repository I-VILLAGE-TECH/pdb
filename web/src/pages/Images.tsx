import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Maker } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { getMarks } from "../lib/marks";
import { LoadingStatus, ProgressBar, Spinner } from "../components/Loading";

// 画像: 元画像のアップロード(フォルダごと。未登録・変更分だけ送る)と、現行マクロの画像系ボタンに相当する画像ファイルの出力(ZIP)

type Summary = { referenced: number; uploaded: number; missing: number; stored: number };
type MissingList = { total: number; items: Array<{ fileName: string; productCodes: string[] }> };
type CheckResult = { name: string; referenced: boolean; status: "new" | "changed" | "same" };
type OutputKind = { kind: string; label: string; book: "PL" | "CF" };
type Preview = {
  products: number;
  files: number;
  issueCount: number;
  issues: Array<{ productCode: string; fileName: string; reason: string }>;
};

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;
// 1リクエストあたりのファイル数と合計サイズ(Cloud Run は1リクエスト32MiBまで)
const BATCH = 10;
const BATCH_BYTES = 24 * 1024 * 1024;
const PARALLEL = 3; // 同時に送るリクエスト数

// フォルダ選択で得たファイル(相対パスつき)
type Picked = { file: File; path: string };

function UploadPanel({ onDone }: { onDone: () => void }) {
  const [picked, setPicked] = useState<Picked[]>([]);
  const [checks, setChecks] = useState<Map<string, CheckResult> | null>(null);
  const [onlyReferenced, setOnlyReferenced] = useState(true);
  const [resendChanged, setResendChanged] = useState(true);
  const [checking, setChecking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failures, setFailures] = useState<Array<{ fileName: string; error: string }>>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const cancelRef = useRef(false);

  async function pick(files: FileList | null) {
    setChecks(null);
    setMessage("");
    setError("");
    setFailures([]);
    const list: Picked[] = [...(files ?? [])]
      .filter((f) => IMAGE_EXT.test(f.name))
      .map((f) => ({ file: f, path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name }));
    setPicked(list);
    if (list.length === 0) return;
    setChecking(true);
    try {
      const map = new Map<string, CheckResult>();
      for (let i = 0; i < list.length; i += 5000) {
        const chunk = list.slice(i, i + 5000).map((p) => ({ name: p.file.name, size: p.file.size }));
        const res = await api<CheckResult[]>("/api/images/check", { method: "POST", body: JSON.stringify({ files: chunk }) });
        for (const r of res) map.set(r.name.toLowerCase(), r);
      }
      setChecks(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  }

  // 同じファイル名が複数のフォルダにある場合は1件だけ送る(元画像はファイル名で引き当てるため)。
  // 現行マクロはメーカーのフォルダを先に探し、無ければ common を見るので、common 以外を優先する
  const isCommon = (p: Picked) => /(^|\/)common\//i.test(p.path);
  const byName = new Map<string, Picked[]>();
  for (const p of picked) {
    const k = p.file.name.toLowerCase();
    byName.set(k, [...(byName.get(k) ?? []), p].sort((a, b) => Number(isCommon(a)) - Number(isCommon(b))));
  }
  const duplicates = [...byName.values()].filter((v) => v.length > 1);
  const targets = [...byName.values()]
    .map((v) => v[0])
    .filter((p) => {
      const c = checks?.get(p.file.name.toLowerCase());
      if (!c) return false;
      if (onlyReferenced && !c.referenced) return false;
      return c.status === "new" || (resendChanged && c.status === "changed");
    });
  const count = (fn: (c: CheckResult) => boolean) => [...(checks?.values() ?? [])].filter(fn).length;

  async function upload() {
    cancelRef.current = false;
    setUploading(true);
    setStartedAt(Date.now());
    setError("");
    setMessage("");
    setFailures([]);
    setProgress({ done: 0, total: targets.length });
    const batches: Picked[][] = [];
    let cur: Picked[] = [];
    let curBytes = 0;
    for (const p of targets) {
      if (cur.length > 0 && (cur.length >= BATCH || curBytes + p.file.size > BATCH_BYTES)) {
        batches.push(cur);
        cur = [];
        curBytes = 0;
      }
      cur.push(p);
      curBytes += p.file.size;
    }
    if (cur.length > 0) batches.push(cur);
    const failed: Array<{ fileName: string; error: string }> = [];
    let done = 0;
    let next = 0;
    async function worker() {
      while (next < batches.length && !cancelRef.current) {
        const batch = batches[next++];
        const form = new FormData();
        for (const p of batch) form.append("files", p.file);
        form.append("paths", JSON.stringify(batch.map((p) => p.path)));
        try {
          const res = await fetch("/api/images/upload", { method: "POST", credentials: "same-origin", body: form });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
          }
          const data = (await res.json()) as { results: Array<{ fileName: string; ok: boolean; error?: string }> };
          for (const r of data.results) if (!r.ok) failed.push({ fileName: r.fileName, error: r.error ?? "" });
        } catch (e) {
          for (const p of batch) failed.push({ fileName: p.file.name, error: e instanceof Error ? e.message : String(e) });
        }
        done += batch.length;
        setProgress({ done, total: targets.length });
      }
    }
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    setFailures(failed);
    setUploading(false);
    setStartedAt(null);
    setMessage(
      `${cancelRef.current ? "中止しました。" : ""}${done - failed.length} 件をアップロードしました${failed.length ? `（失敗 ${failed.length} 件）` : ""}`
    );
    setPicked([]);
    setChecks(null);
    onDone();
  }

  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>元画像のアップロード（管理者）</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        現行の画像フォルダ（例: img\cf_item_img・img\pl_item_img）をフォルダごと選びます。サブフォルダ（メーカー別・common）も含めて読み込み、
        まだ無いもの・中身が変わったものだけを送ります。画像はファイル名で商品に引き当てます（大文字小文字は区別しません）。
      </p>
      {error && <div className="error">{error}</div>}
      {message && <div style={{ color: "#166534", padding: "4px 0" }}>{message}</div>}
      <div className="field">
        <input
          type="file"
          multiple
          disabled={uploading}
          // @ts-expect-error フォルダ選択(Chrome・Edge・Safari 対応の非標準属性)
          webkitdirectory=""
          onChange={(e) => pick(e.target.files)}
        />
      </div>
      {checking && <LoadingStatus message={`照合しています（${picked.length.toLocaleString()} ファイル）`} />}
      {checks && (
        <>
          <div style={{ marginBottom: 8 }}>
            画像 {picked.length.toLocaleString()} ファイル：未登録 <b>{count((c) => c.status === "new").toLocaleString()}</b> ／ 変更あり{" "}
            <b>{count((c) => c.status === "changed").toLocaleString()}</b> ／ 登録済み {count((c) => c.status === "same").toLocaleString()}（
            うち商品で使われていない {count((c) => !c.referenced).toLocaleString()}）
          </div>
          {duplicates.length > 0 && (
            <details style={{ marginBottom: 8 }}>
              <summary className="muted">
                同じファイル名が複数のフォルダにあります（{duplicates.length} 件。common 以外のフォルダのものを優先して送ります）
              </summary>
              <ul className="muted" style={{ maxHeight: 160, overflowY: "auto" }}>
                {duplicates.slice(0, 200).map((d) => (
                  <li key={d[0].file.name}>{d.map((p) => p.path).join(" ／ ")}</li>
                ))}
              </ul>
            </details>
          )}
          <label className="checkbox-filter" style={{ marginRight: 16 }}>
            <input type="checkbox" checked={onlyReferenced} onChange={(e) => setOnlyReferenced(e.target.checked)} />
            商品で使われている画像だけ送る
          </label>
          <label className="checkbox-filter">
            <input type="checkbox" checked={resendChanged} onChange={(e) => setResendChanged(e.target.checked)} />
            中身が変わった画像も送り直す
          </label>
        </>
      )}
      {uploading && (
        <>
          <ProgressBar percent={progress.total ? Math.round((progress.done / progress.total) * 100) : null} style={{ margin: "8px 0" }} />
          <LoadingStatus
            message={`アップロード中 ${progress.done.toLocaleString()} / ${progress.total.toLocaleString()} ファイル`}
            startedAt={startedAt}
            note="画面を閉じると中断します。中断しても、次回は残りだけを送ります"
          />
        </>
      )}
      <div className="toolbar" style={{ marginTop: 8, marginBottom: 0 }}>
        <button type="button" className="primary" disabled={!checks || targets.length === 0 || uploading} onClick={upload}>
          {uploading ? <Spinner /> : null}
          アップロード（{targets.length.toLocaleString()} ファイル）
        </button>
        {uploading && (
          <button type="button" onClick={() => (cancelRef.current = true)}>
            中止
          </button>
        )}
      </div>
      {failures.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary className="error">失敗 {failures.length} 件</summary>
          <ul className="muted" style={{ maxHeight: 200, overflowY: "auto" }}>
            {failures.slice(0, 200).map((f, i) => (
              <li key={i}>
                {f.fileName}: {f.error}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function OutputPanel() {
  const { user } = useAuth();
  const [kinds, setKinds] = useState<OutputKind[]>([]);
  const [makers, setMakers] = useState<Maker[]>([]);
  const [kind, setKind] = useState("fs_cf");
  const [codes, setCodes] = useState("");
  const [markedOnly, setMarkedOnly] = useState(false);
  const [makerId, setMakerId] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [includeDiscontinued, setIncludeDiscontinued] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"" | "preview" | "download">("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const marks = user ? getMarks(user.id) : new Set<string>();

  useEffect(() => {
    api<OutputKind[]>("/api/images/output-kinds").then(setKinds).catch(() => {});
    api<Maker[]>("/api/makers").then(setMakers).catch(() => {});
  }, []);

  function body() {
    const list = codes.split(/[\s,、]+/).map((c) => c.trim()).filter(Boolean);
    const productCodes = markedOnly ? [...marks] : list;
    return {
      kind,
      ...(productCodes.length > 0 && { productCodes }),
      ...(makerId && { makerId: Number(makerId) }),
      ...(updatedFrom && { updatedFrom }),
      ...(updatedTo && { updatedTo }),
      ...((kind === "fs_cf" || kind === "list_cf") && includeDiscontinued && { includeDiscontinued: true }),
    };
  }

  async function runPreview() {
    setBusy("preview");
    setError("");
    try {
      setPreview(await api<Preview>("/api/images/output/preview", { method: "POST", body: JSON.stringify(body()) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  async function download() {
    setBusy("download");
    setStartedAt(Date.now());
    setError("");
    try {
      const res = await fetch("/api/images/output/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body()),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const star = /filename\*=UTF-8''([^;]+)/.exec(cd)?.[1];
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = star ? decodeURIComponent(star) : "images.zip";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
      setStartedAt(null);
    }
  }

  const current = kinds.find((k) => k.kind === kind);
  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>画像ファイルの出力</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Excel の画像系ボタン（FS_CopyIMG_FmodelName・FS_ListIMG_syukusen・Yahoo画像リネーム）と同じ名前・構成の画像を ZIP で出力します。
        対象は商品登録フラグ○の商品です。Excel で範囲を選ぶ代わりに、商品コード・マーク・メーカー・更新日で絞り込みます。
      </p>
      {error && <div className="error">{error}</div>}
      <div className="field">
        <label>出力する画像</label>
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setPreview(null);
          }}
        >
          {kinds.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>商品コード（空欄なら全商品。スペース・改行・カンマ区切り）</label>
        <textarea
          rows={3}
          value={codes}
          disabled={markedOnly}
          onChange={(e) => {
            setCodes(e.target.value);
            setPreview(null);
          }}
          placeholder={current?.book === "PL" ? "例: OD-0010E-CL" : "例: KIF001 KIF002"}
        />
        <label className="checkbox-filter">
          <input type="checkbox" checked={markedOnly} onChange={(e) => setMarkedOnly(e.target.checked)} />
          ★ マーク付きの商品のみ（{marks.size} 件マーク中）
        </label>
      </div>
      <div className="toolbar">
        <select value={makerId} onChange={(e) => setMakerId(e.target.value)}>
          <option value="">メーカー（すべて）</option>
          {makers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.makerCode} {m.nameJp}
            </option>
          ))}
        </select>
        <label className="muted">
          更新日 <input type="date" value={updatedFrom} onChange={(e) => setUpdatedFrom(e.target.value)} /> 〜{" "}
          <input type="date" value={updatedTo} onChange={(e) => setUpdatedTo(e.target.value)} />
        </label>
        {(kind === "fs_cf" || kind === "list_cf") && (
          <label className="checkbox-filter">
            <input type="checkbox" checked={includeDiscontinued} onChange={(e) => setIncludeDiscontinued(e.target.checked)} />
            生産終了品も含める
          </label>
        )}
      </div>
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <button type="button" disabled={!!busy} onClick={runPreview}>
          {busy === "preview" ? <Spinner /> : null}
          対象を確認
        </button>
        <button type="button" className="primary" disabled={!!busy} onClick={download}>
          {busy === "download" ? <Spinner /> : null}
          ZIP をダウンロード
        </button>
      </div>
      {busy === "download" && (
        <LoadingStatus message="画像をまとめています" startedAt={startedAt} note="全商品だと数分かかります。商品を絞ると早くなります" />
      )}
      {preview && (
        <div style={{ marginTop: 10 }}>
          対象商品 <b>{preview.products.toLocaleString()}</b> 件 ／ 出力 <b>{preview.files.toLocaleString()}</b> ファイル
          {preview.issueCount > 0 && (
            <>
              {" "}
              ／ <span className="error">注意 {preview.issueCount.toLocaleString()} 件</span>
            </>
          )}
          {preview.issues.length > 0 && (
            <details style={{ marginTop: 6 }}>
              <summary className="muted">注意の内容（未アップロードの元画像など。ZIP 内の _result.txt にも全件を出力します）</summary>
              <table style={{ marginTop: 6 }}>
                <thead>
                  <tr>
                    <th>商品コード</th>
                    <th>ファイル名</th>
                    <th>内容</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.issues.map((i, n) => (
                    <tr key={n}>
                      <td>{i.productCode}</td>
                      <td>{i.fileName}</td>
                      <td className="muted">{i.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export function Images() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [missing, setMissing] = useState<MissingList | null>(null);

  const load = useCallback(() => {
    api<Summary>("/api/images/summary").then(setSummary).catch(() => {});
    api<MissingList>("/api/images/missing").then(setMissing).catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h2>画像</h2>
      <div className="panel">
        {summary ? (
          <div>
            商品で使われている画像 <b>{summary.referenced.toLocaleString()}</b> 件 ／ アップロード済み{" "}
            <b>{summary.uploaded.toLocaleString()}</b> 件 ／{" "}
            <b className={summary.missing ? "error" : undefined}>未アップロード {summary.missing.toLocaleString()} 件</b>
          </div>
        ) : (
          <LoadingStatus message="読み込み中" />
        )}
        {missing && missing.total > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary className="muted">
              未アップロードの画像（{missing.total.toLocaleString()} 件
              {missing.total > missing.items.length ? `。先頭 ${missing.items.length} 件を表示` : ""}）
            </summary>
            <p>
              <a href="/api/images/missing?format=csv">全件を CSV でダウンロード</a>
            </p>
            <ul className="muted" style={{ maxHeight: 240, overflowY: "auto" }}>
              {missing.items.map((m) => (
                <li key={m.fileName}>
                  {m.fileName}（{m.productCodes.slice(0, 5).join(", ")}
                  {m.productCodes.length > 5 ? ` ほか${m.productCodes.length - 5}件` : ""}）
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      {user?.role === "ADMIN" && <UploadPanel onDone={load} />}
      <OutputPanel />
    </div>
  );
}
