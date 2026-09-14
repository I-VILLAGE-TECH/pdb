import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

type Channel = {
  id: number;
  code: string;
  name: string;
  transferType: string;
  charset: string;
  stockSyncMode: string;
  upsertMode: string;
  splitRows: number | null;
  active: boolean;
  reflectMode: string;
  verifySource: string;
  _count?: { productLinks: number; fieldMaps: number };
};

const STOCK_MODE_LABEL: Record<string, string> = {
  QUANTITY: "数量連携",
  AVAILABILITY: "あり/なし",
  NONE: "なし",
};

export function Channels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<Channel[]>("/api/channels").then(setChannels).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(c: Channel) {
    try {
      await api(`/api/channels/${c.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !c.active }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function setStockMode(c: Channel, mode: string) {
    try {
      await api(`/api/channels/${c.id}`, {
        method: "PUT",
        body: JSON.stringify({ stockSyncMode: mode }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <h2>連携先設定</h2>
      <p className="muted">
        在庫連携は連携先ごとに「数量連携 / あり・なし連携」を切り替えられます（ユースケース③）。
      </p>
      {error && <div className="error">{error}</div>}
      <table>
        <thead>
          <tr>
            <th>コード</th>
            <th>連携先</th>
            <th>送信方式</th>
            <th>文字コード</th>
            <th>在庫連携</th>
            <th>更新方式</th>
            <th>分割件数</th>
            <th>結果確認</th>
            <th>連携SKU数</th>
            <th>有効</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((c) => (
            <tr key={c.id} style={{ opacity: c.active ? 1 : 0.5 }}>
              <td>{c.code}</td>
              <td>{c.name}</td>
              <td>
                <span className="badge gray">{c.transferType}</span>
              </td>
              <td>{c.charset === "SHIFT_JIS" ? "Shift_JIS" : "UTF-8"}</td>
              <td>
                <select value={c.stockSyncMode} onChange={(e) => setStockMode(c, e.target.value)}>
                  {Object.entries(STOCK_MODE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </td>
              <td>{c.upsertMode}</td>
              <td className="num">{c.splitRows ?? "-"}</td>
              <td>{c.verifySource}</td>
              <td className="num">{c._count?.productLinks ?? 0}</td>
              <td>
                <button onClick={() => toggleActive(c)}>{c.active ? "有効" : "無効"}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
