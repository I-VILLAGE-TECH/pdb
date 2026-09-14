import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, DIFF_LABEL, Paged } from "../lib/api";

type ChannelLite = { id: number; code: string; name: string; active: boolean };

type SyncLink = {
  id: number;
  diffStatus: string;
  linkStatus: string;
  syncStatus: string;
  lastSentAt: string | null;
  updatedAt: string;
  channel: { id: number; code: string; name: string };
  product: { id: number; productCode: string; name: string; updatedAt: string };
  variation: { id: number; skuCode: string; stockQty: number; price: number | null };
};

type SyncJob = {
  id: number;
  jobType: string;
  status: string;
  rowCount: number;
  triggeredBy: string | null;
  startedAt: string;
  channel: { code: string; name: string };
};

export function SyncStatus() {
  const [channels, setChannels] = useState<ChannelLite[]>([]);
  const [channelId, setChannelId] = useState<number | "">("");
  const [links, setLinks] = useState<Paged<SyncLink> | null>(null);
  const [jobs, setJobs] = useState<Paged<SyncJob> | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<ChannelLite[]>("/api/channels")
      .then((cs) => setChannels(cs.filter((c) => c.active)))
      .catch((e) => setError(e.message));
  }, []);

  const loadLinks = useCallback(() => {
    const q = new URLSearchParams();
    if (channelId) q.set("channelId", String(channelId));
    api<Paged<SyncLink>>(`/api/sync/links?${q}`)
      .then((d) => {
        setLinks(d);
        setSelected(new Set());
      })
      .catch((e) => setError(e.message));
    api<Paged<SyncJob>>("/api/sync/jobs")
      .then(setJobs)
      .catch(() => {});
  }, [channelId]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  async function recalculate() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ channels: number; links: number }>("/api/sync/recalculate", {
        method: "POST",
        body: JSON.stringify(channelId ? { channelId } : {}),
      });
      setMessage(`差分を再計算しました（${result.links} SKU×連携先）`);
      loadLinks();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function reflect() {
    if (!channelId) {
      setError("反映する連携先を選択してください");
      return;
    }
    if (selected.size === 0) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ jobId: number; rowCount: number }>("/api/sync/reflect", {
        method: "POST",
        body: JSON.stringify({
          channelId,
          linkIds: Array.from(selected),
          triggeredBy: "web",
        }),
      });
      setMessage(`反映ジョブ #${result.jobId} を作成しました（${result.rowCount} 件）`);
      loadLinks();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // remote_drift / both は既定で未チェック（共通設計 §6）
  function selectDefault() {
    if (!links) return;
    setSelected(
      new Set(
        links.items
          .filter((l) => l.diffStatus === "UNREGISTERED" || l.diffStatus === "LOCAL_CHANGED")
          .map((l) => l.id)
      )
    );
  }

  return (
    <div>
      <h2>連携状況</h2>
      <p className="muted">
        差分のある SKU × 連携先 を表示します。反映は手動（選択分のみ）です。
      </p>

      <div className="toolbar">
        <select
          value={channelId}
          onChange={(e) => setChannelId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">全連携先</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button onClick={recalculate} disabled={busy}>
          差分を再計算
        </button>
        <button onClick={selectDefault}>既定で選択</button>
        <button className="primary" onClick={reflect} disabled={busy || selected.size === 0}>
          反映（{selected.size} 件）
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div style={{ color: "#166534", padding: "8px 0" }}>{message}</div>}

      <table>
        <thead>
          <tr>
            <th style={{ width: 32 }}></th>
            <th>連携先</th>
            <th>商品コード</th>
            <th>SKU</th>
            <th>商品名</th>
            <th>差分</th>
            <th>DB更新</th>
            <th>最終反映</th>
          </tr>
        </thead>
        <tbody>
          {links?.items.map((l) => (
            <tr key={l.id}>
              <td>
                <input
                  type="checkbox"
                  checked={selected.has(l.id)}
                  onChange={() => toggle(l.id)}
                />
              </td>
              <td>{l.channel.name}</td>
              <td>
                <Link to={`/products/${l.product.id}`}>{l.product.productCode}</Link>
              </td>
              <td>{l.variation.skuCode}</td>
              <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {l.product.name}
              </td>
              <td>{DIFF_LABEL[l.diffStatus] ?? l.diffStatus}</td>
              <td className="muted">{new Date(l.product.updatedAt).toLocaleDateString("ja-JP")}</td>
              <td className="muted">
                {l.lastSentAt ? new Date(l.lastSentAt).toLocaleString("ja-JP") : "-"}
              </td>
            </tr>
          ))}
          {links && links.items.length === 0 && (
            <tr>
              <td colSpan={8} className="muted">
                差分はありません。「差分を再計算」で連携リンクを更新できます。
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {links && links.total > links.perPage && (
        <div className="pagination">
          全 {links.total.toLocaleString()} 件中 {links.items.length} 件を表示
        </div>
      )}

      <h3>反映履歴</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>連携先</th>
            <th>種別</th>
            <th>件数</th>
            <th>実行者</th>
            <th>状態</th>
            <th>日時</th>
          </tr>
        </thead>
        <tbody>
          {jobs?.items.map((j) => (
            <tr key={j.id}>
              <td>{j.id}</td>
              <td>{j.channel.name}</td>
              <td>{j.jobType}</td>
              <td className="num">{j.rowCount}</td>
              <td>{j.triggeredBy ?? "-"}</td>
              <td>
                <span className="badge gray">{j.status}</span>
              </td>
              <td>{new Date(j.startedAt).toLocaleString("ja-JP")}</td>
            </tr>
          ))}
          {jobs && jobs.items.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                まだ反映履歴はありません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
