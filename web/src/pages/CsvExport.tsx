import { useEffect, useState } from "react";
import { api, STATUS_LABEL } from "../lib/api";
import { LoadingStatus, ProgressBar, Spinner } from "../components/Loading";
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
  startedAt?: number;
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

  // futureshop以外の連携先のファイル種別(サーバの lib/mallCsv.ts の定義。現行マクロのボタン相当)
  type MallFileType = { key: string; label: string; book: string; isSet: boolean };
  const [mallTypes, setMallTypes] = useState<MallFileType[]>([]);
  useEffect(() => {
    setMallTypes([]);
    if (target === MASTER || !selectedChannel || selectedChannel.code === "futureshop") return;
    api<{ fileTypes: MallFileType[] }>(`/api/exports/file-types?channelId=${target}`)
      .then((r) => setMallTypes(r.fileTypes))
      .catch((e) => setError(e.message));
  }, [target, selectedChannel]);

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
      // 連携先CSVはサーバが1リクエストで生成して返す(数秒)。生成中はダイアログを表示
      setExportJob({ status: "RUNNING", phase: "作成中", processed: 0, total: 0, startedAt: Date.now() });
      try {
        await downloadByPost("/api/exports/download", { ...filterBody(), channelId: Number(target) });
        setExportJob(null);
      } catch (e) {
        // ダイアログにエラー表示(閉じるで消す)
        setExportJob({ status: "ERROR", phase: "", processed: 0, total: 0, error: e instanceof Error ? e.message : String(e) });
      }
    } catch (e) {
      setExportJob(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // HTML出力(現行マクロの SPEC / Original＆Spec)。タブのブックで種別が決まる。絞り込みは上と同じ
  const htmlType = categoryTab === "CEILING_FAN" ? "cf_original_spec" : "pl_spec";
  const [htmlStartedAt, setHtmlStartedAt] = useState<number | null>(null);
  const [htmlResult, setHtmlResult] = useState("");
  async function downloadHtml() {
    setError("");
    setHtmlResult("");
    setHtmlStartedAt(Date.now());
    try {
      const { fileType: _ignored, ...body } = filterBody();
      const res = await fetch("/api/html-exports/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ...body, type: htmlType }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; errors?: string[] };
        throw new Error([err.error ?? `HTTP ${res.status}`, ...(err.errors ?? []).slice(0, 10)].join("\n"));
      }
      await saveBlobResponse(res);
      setHtmlResult("ZIP を保存しました。データ不備で出力しなかった商品があれば、ZIP 内の errors.txt に一覧があります");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setHtmlStartedAt(null);
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
  // PLブック(ペンダントライト一覧)とCFブック(シーリングファン一覧)でボタン構成が異なる
  const FS_FILE_TYPES_PL = [
    { key: "products", label: "商品CSV(FS_ccGoods)" },
    { key: "option_set", label: "オプション(PL・基本+選択肢の2ファイル)" },
    { key: "variation_set_new", label: "バリエーション NewItem(PL・4ファイル)" },
    { key: "variation_set_update", label: "バリエーション Update(PL・4ファイル)" },
    { key: "category", label: "グループひもづけ(PL・カテゴリCSV)" },
  ];
  const FS_FILE_TYPES_CF = [
    { key: "products", label: "商品CSV(FS_ccGoods)" },
    { key: "comment16", label: "独自コメント16のみ更新(CF・商品CSV形式)" },
    { key: "category", label: "グループひもづけ(CF・カテゴリCSV)" },
    { key: "option_set", label: "オプション(CF・取付工事 基本+選択肢の2ファイル)" },
    { key: "tag", label: "商品タグ(CF)" },
    { key: "variation_set_new", label: "バリエーション NewItem(CF・3ファイル)" },
    { key: "variation_set_update", label: "バリエーション Update(CF・3ファイル)" },
    { key: "image_alt", label: "商品画像ALT(CF)" },
  ];
  const isFutureshop = selectedChannel?.code === "futureshop";
  // タブのブック(PL/CF)向けの他連携先の種別。種別が定義された連携先だけ選択肢を出す
  const tabBook = categoryTab === "CEILING_FAN" ? "CF" : "PL";
  const MALL_TYPES_FOR_TAB = mallTypes.filter((t) => t.book === tabBook || t.book === "ANY");
  const FS_FILE_TYPES = isFutureshop
    ? categoryTab === "CEILING_FAN" ? FS_FILE_TYPES_CF : FS_FILE_TYPES_PL
    : [{ key: "products", label: "列定義どおり(SKU単位)" }, ...MALL_TYPES_FOR_TAB.map((t) => ({ key: t.key, label: t.label }))];
  const showFileTypes = isFutureshop || MALL_TYPES_FOR_TAB.length > 0;
  // ZIPでまとめるセット出力はプレビュー対象外(単一CSVのサブ種別はプレビュー可)
  const isSetType =
    ["option_set", "variation_set_new", "variation_set_update"].includes(fileType) ||
    mallTypes.some((t) => t.key === fileType && t.isSet);

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
              // タブ側に無い種別(CF専用のタグ等)が選ばれていたら商品CSVに戻す
              const book = t.key === "CEILING_FAN" ? "CF" : "PL";
              const types = isFutureshop
                ? t.key === "CEILING_FAN" ? FS_FILE_TYPES_CF : FS_FILE_TYPES_PL
                : mallTypes.filter((x) => x.book === book || x.book === "ANY");
              if (!types.some((x) => x.key === fileType)) setFileType("products");
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
                  setFileType("products"); // 種別は連携先ごとに異なる
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
          {showFileTypes && (
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
            {busy ? (
              <>
                <Spinner />
                生成中…
              </>
            ) : (
              "プレビュー"
            )}
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

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>HTML出力（スペックページ等）</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          {categoryTab === "CEILING_FAN"
            ? "現行Excelの「Original＆Spec」ボタン相当。商品登録フラグが ○△■● の商品の製品画像ページ(original/)とスペックページ(spec/)をZIPで出力します。"
            : "現行Excelの「FS_Spec」ボタン相当。商品登録フラグが ○ の商品のスペックページをZIPで出力します（spec/ = ペンダントライト一覧、spec_other/ = その他別管理一覧FS）。"}
          対象は上の絞り込み（タブ・検索・状態・メーカー・マーク付き）に従います。文字コードは UTF-8(BOM付き)です。
        </p>
        <button className="primary" onClick={downloadHtml} disabled={htmlStartedAt != null}>
          {htmlStartedAt != null ? (
            <>
              <Spinner />
              作成中…
            </>
          ) : (
            "HTMLをZIPでダウンロード"
          )}
        </button>
        {htmlStartedAt != null && (
          <LoadingStatus message="HTMLを作成しています" startedAt={htmlStartedAt} note="全件で数秒〜数十秒かかります" />
        )}
        {htmlResult && <div style={{ color: "#166534", paddingTop: 8 }}>{htmlResult}</div>}
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
                <ProgressBar percent={null} />
                <LoadingStatus
                  message="ファイルを作成しています"
                  startedAt={exportJob.startedAt}
                  note="作成が終わると自動でダウンロードが始まります(数秒〜数十秒)"
                />
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
