import { useEffect, useState } from "react";
import { api, STATUS_LABEL } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { clearMarks, getMarks } from "../lib/marks";

type Channel = {
  id: number;
  code: string;
  name: string;
  charset: string;
  stockSyncMode: string;
  active: boolean;
  splitRows: number | null;
  _count?: { fieldMaps: number };
};

type Preview = {
  channel: { code: string; name: string; charset: string };
  header: string[];
  rows: string[][];
  total: number;
  splitRows: number | null;
};

const MASTER = "master"; // 汎用（マスタ形式）

// POSTでCSVを受け取ってダウンロード（マーク一覧はURLに載らないためPOST）
async function downloadByPost(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  await saveBlobResponse(res);
}

// レスポンスをファイル保存(Content-Dispositionのfilename*を優先)
async function saveBlobResponse(res: Response) {
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const star = /filename\*=UTF-8''([^;]+)/.exec(cd)?.[1];
  const filename = star ? decodeURIComponent(star) : (/filename="([^"]+)"/.exec(cd)?.[1] ?? "export.csv");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

type ExportJobStatus = {
  status: "RUNNING" | "DONE" | "ERROR";
  phase: string;
  processed: number;
  total: number;
  filename?: string;
  error?: string;
};

export function CsvExport() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [target, setTarget] = useState<string>(MASTER);
  // 種別タブ（一覧と同様、PLタブはシーリングライトを含む。「すべて」は無し）
  const [categoryTab, setCategoryTab] = useState<"PENDANT_LIGHT" | "CEILING_FAN">("PENDANT_LIGHT");
  const [markedOnly, setMarkedOnly] = useState(false);
  const [fileType, setFileType] = useState("products");
  const [exportJob, setExportJob] = useState<ExportJobStatus | null>(null);
  const [marks, setMarks] = useState<Set<string>>(() =>
    user ? getMarks(user.id) : new Set<string>()
  );
  const [filters, setFilters] = useState({
    category: "",
    status: "",
    updatedFrom: "",
    updatedTo: "",
  });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Channel[]>("/api/channels")
      .then((cs) => setChannels(cs.filter((c) => c.active)))
      .catch((e) => setError(e.message));
  }, []);

  const selectedChannel = channels.find((c) => String(c.id) === target);

  function filterBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      categories:
        categoryTab === "PENDANT_LIGHT"
          ? ["PENDANT_LIGHT", "CEILING_LIGHT"]
          : ["CEILING_FAN"],
    };
    for (const [k, v] of Object.entries(filters)) {
      if (v) body[k] = v;
    }
    if (markedOnly) body.productCodes = [...marks];
    if (fileType !== "products") body.fileType = fileType;
    return body;
  }

  async function loadPreview() {
    if (target === MASTER) return;
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      setPreview(
        await api<Preview>("/api/exports/preview", {
          method: "POST",
          body: JSON.stringify({ ...filterBody(), channelId: Number(target) }),
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setError("");
    try {
      if (target === MASTER) {
        await downloadByPost("/api/products/export", filterBody());
        return;
      }
      // 連携先CSVは時間がかかるためジョブ化して進捗をダイアログ表示
      const { jobId } = await api<{ jobId: string }>("/api/exports/jobs", {
        method: "POST",
        body: JSON.stringify({ ...filterBody(), channelId: Number(target) }),
      });
      setExportJob({ status: "RUNNING", phase: "準備中", processed: 0, total: 0 });
      for (;;) {
        await new Promise((r) => setTimeout(r, 500));
        const st = await api<ExportJobStatus>(`/api/exports/jobs/${jobId}`);
        setExportJob(st);
        if (st.status === "DONE") {
          const res = await fetch(`/api/exports/jobs/${jobId}/download`, {
            credentials: "same-origin",
          });
          if (!res.ok) throw new Error("ダウンロードに失敗しました");
          await saveBlobResponse(res);
          setExportJob(null);
          return;
        }
        if (st.status === "ERROR") return; // ダイアログにエラー表示(閉じるで消す)
      }
    } catch (e) {
      setExportJob(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function set(key: keyof typeof filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPreview(null);
  }

  const categoryTabs = [
    { key: "PENDANT_LIGHT", label: "ペンダントライト" },
    { key: "CEILING_FAN", label: "シーリングファン" },
  ] as const;

  // futureshopのファイル種別(現行Excelのボタンと同じ粒度。セットはZIPでまとめて出力)
  const FS_FILE_TYPES = [
    { key: "products", label: "商品CSV(FS_ccGoods)" },
    { key: "option_set", label: "オプション(PL・基本+選択肢の2ファイル)" },
    { key: "variation_set_new", label: "バリエーション NewItem(PL・4ファイル)" },
    { key: "variation_set_update", label: "バリエーション Update(PL・4ファイル)" },
  ] as const;
  const isFutureshop = selectedChannel?.code === "futureshop";
  const isSetType = fileType !== "products";

  return (
    <div>
      <h2>CSV出力</h2>
      <p className="muted">
        プラットフォームごとの列定義（channel_field_maps）でCSVを生成します。文字コード・在庫の出力方式（数量/あり・なし）・価格の採用列は連携先設定に従います。
      </p>
      <div className="tabs">
        {categoryTabs.map((t) => (
          <button
            key={t.key}
            className={`tab ${categoryTab === t.key ? "active" : ""}`}
            onClick={() => {
              setCategoryTab(t.key);
              setPreview(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {error && <div className="error">{error}</div>}

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>出力先</h3>
        <div className="export-targets">
          <label className={`export-target ${target === MASTER ? "selected" : ""}`}>
            <input
              type="radio"
              name="target"
              checked={target === MASTER}
              onChange={() => {
                setTarget(MASTER);
                setPreview(null);
              }}
            />
            <div>
              <div className="target-name">汎用（マスタ形式）</div>
              <div className="muted">全項目・UTF-8(BOM)・商品単位</div>
            </div>
          </label>
          {channels.map((c) => (
            <label
              key={c.id}
              className={`export-target ${target === String(c.id) ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="target"
                checked={target === String(c.id)}
                onChange={() => {
                  setTarget(String(c.id));
                  setPreview(null);
                }}
              />
              <div>
                <div className="target-name">{c.name}</div>
                <div className="muted">
                  {c.charset === "SHIFT_JIS" ? "Shift_JIS" : "UTF-8"}・
                  {c.stockSyncMode === "QUANTITY"
                    ? "在庫数量"
                    : c.stockSyncMode === "AVAILABILITY"
                      ? "在庫あり/なし"
                      : "在庫なし"}
                  ・{c._count?.fieldMaps ?? 0}列・SKU単位
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>絞り込み</h3>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          {isFutureshop && (
            <select
              value={fileType}
              onChange={(e) => {
                setFileType(e.target.value);
                setPreview(null);
              }}
            >
              {FS_FILE_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
          <select value={filters.status} onChange={(e) => set("status", e.target.value)}>
            <option value="">全ステータス</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <span className="date-filter">
            <label>更新日時</label>
            <input
              type="date"
              value={filters.updatedFrom}
              onChange={(e) => set("updatedFrom", e.target.value)}
            />
            <span className="muted">〜</span>
            <input
              type="date"
              value={filters.updatedTo}
              onChange={(e) => set("updatedTo", e.target.value)}
            />
          </span>
          <label className="checkbox-filter">
            <input
              type="checkbox"
              checked={markedOnly}
              onChange={(e) => {
                setMarkedOnly(e.target.checked);
                setPreview(null);
              }}
            />
            ★ マーク付きのみ出力（{marks.size} 件マーク中）
          </label>
          {marks.size > 0 && (
            <button
              onClick={() => {
                if (!user) return;
                if (!confirm(`マーク ${marks.size} 件をすべてクリアしますか？`)) return;
                setMarks(new Set(clearMarks(user.id)));
                setPreview(null);
              }}
            >
              マークをクリア
            </button>
          )}
        </div>
        {markedOnly && marks.size === 0 && (
          <div className="error" style={{ marginTop: 8 }}>
            マークされた商品がありません。商品一覧の ★ 列でマークしてください。
          </div>
        )}
      </div>

      <div className="toolbar">
        {target !== MASTER && !isSetType && (
          <button onClick={loadPreview} disabled={busy || (markedOnly && marks.size === 0)}>
            {busy ? "生成中…" : "プレビュー"}
          </button>
        )}
        <button
          className="primary"
          onClick={download}
          disabled={(markedOnly && marks.size === 0) || exportJob !== null}
        >
          CSVダウンロード
        </button>
        {preview && (
          <span className="muted">
            全 {preview.total.toLocaleString()} 行（SKU単位）
            {preview.splitRows && preview.total > preview.splitRows && (
              <>
                ・分割目安 {preview.splitRows} 行を超えています（
                {Math.ceil(preview.total / preview.splitRows)} ファイルに分けてのアップロードを推奨）
              </>
            )}
          </span>
        )}
      </div>

      {exportJob && (
        <div className="modal-backdrop">
          <div className="modal" style={{ width: 420 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>CSV出力</h3>
            </div>
            {exportJob.status === "ERROR" ? (
              <>
                <p className="error" style={{ whiteSpace: "pre-wrap" }}>
                  エラー: {exportJob.error ?? "不明なエラー"}
                </p>
                <div style={{ textAlign: "right" }}>
                  <button onClick={() => setExportJob(null)}>閉じる</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 10px" }}>
                  {exportJob.phase}
                  {exportJob.total > 0 && exportJob.phase === "生成中" && (
                    <>
                      …{exportJob.processed.toLocaleString()} / {exportJob.total.toLocaleString()} 件
                    </>
                  )}
                </p>
                <div
                  style={{
                    height: 10,
                    borderRadius: 5,
                    background: "rgba(100,116,139,0.25)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width:
                        exportJob.status === "DONE"
                          ? "100%"
                          : exportJob.total > 0
                            ? `${Math.round((exportJob.processed / exportJob.total) * 100)}%`
                            : "8%",
                      background: "var(--accent, #2563eb)",
                      transition: "width 0.3s",
                    }}
                  />
                </div>
                <p className="muted" style={{ marginTop: 10 }}>
                  {exportJob.status === "DONE"
                    ? "ダウンロードを開始しています…"
                    : "生成が完了すると自動でダウンロードが始まります"}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {preview && (
        <>
          <h3>
            プレビュー（先頭 {preview.rows.length} 行 / {preview.channel.name}）
          </h3>
          <div className="table-scroll">
            <table className="table-nowrap">
              <thead>
                <tr>
                  {preview.header.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedChannel && (selectedChannel._count?.fieldMaps ?? 0) === 0 && (
        <div className="error">
          この連携先はCSV列定義（channel_field_maps）が未登録のため出力できません。
        </div>
      )}
    </div>
  );
}
