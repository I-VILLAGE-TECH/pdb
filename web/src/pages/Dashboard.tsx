import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, CATEGORY_LABEL, STATUS_LABEL } from "../lib/api";

type DashboardData = {
  byCategory: Array<{ category: string; _count: number }>;
  byStatus: Array<{ status: string; _count: number }>;
  makerCount: number;
  variationCount: number;
  pendingLinks: number;
  recentJobs: Array<{
    id: number;
    jobType: string;
    status: string;
    rowCount: number;
    startedAt: string;
    channel: { name: string };
  }>;
};

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("/api/dashboard").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="muted">読み込み中…</div>;

  const totalProducts = data.byCategory.reduce((a, c) => a + c._count, 0);

  return (
    <div>
      <h2>ダッシュボード</h2>
      <div className="stats">
        <div className="stat-card">
          <div className="value">{totalProducts.toLocaleString()}</div>
          <div className="label">商品数（全種別）</div>
        </div>
        {data.byCategory.map((c) => (
          <div className="stat-card" key={c.category}>
            <div className="value">{c._count.toLocaleString()}</div>
            <div className="label">{CATEGORY_LABEL[c.category] ?? c.category}</div>
          </div>
        ))}
        <div className="stat-card">
          <div className="value">{data.variationCount.toLocaleString()}</div>
          <div className="label">SKU数</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.makerCount}</div>
          <div className="label">メーカー数</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.pendingLinks.toLocaleString()}</div>
          <div className="label">
            <Link to="/sync">未反映の連携差分</Link>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>商品ステータス内訳</h3>
        <table>
          <tbody>
            {data.byStatus.map((s) => (
              <tr key={s.status}>
                <td>{STATUS_LABEL[s.status] ?? s.status}</td>
                <td className="num">{s._count.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>最近の反映ジョブ</h3>
        {data.recentJobs.length === 0 ? (
          <div className="muted">まだ反映履歴はありません</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>連携先</th>
                <th>種別</th>
                <th>件数</th>
                <th>状態</th>
                <th>日時</th>
              </tr>
            </thead>
            <tbody>
              {data.recentJobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.id}</td>
                  <td>{j.channel.name}</td>
                  <td>{j.jobType}</td>
                  <td className="num">{j.rowCount}</td>
                  <td>
                    <span className="badge gray">{j.status}</span>
                  </td>
                  <td>{new Date(j.startedAt).toLocaleString("ja-JP")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
