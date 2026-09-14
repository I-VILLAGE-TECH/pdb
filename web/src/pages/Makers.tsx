import { useCallback, useEffect, useState } from "react";
import { api, Maker } from "../lib/api";
import { Modal } from "../components/filters";

export function Makers() {
  const [makers, setMakers] = useState<Maker[]>([]);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ makerCode: "", nameJp: "", nameEn: "", imgFolder: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<Maker[]>("/api/makers").then(setMakers).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    load();
  }

  // セル編集（フォーカス外しで保存）
  function editableCell(m: Maker, field: "nameJp" | "nameEn" | "imgFolder", required = false) {
    const current = m[field] ?? "";
    return (
      <input
        key={`${m.id}-${field}-${current}`}
        defaultValue={current}
        placeholder="-"
        className="cell-input"
        onBlur={(e) => {
          const value = e.target.value.trim();
          if (required && !value) {
            e.target.value = current;
            return;
          }
          if (value !== current) {
            run(() =>
              api(`/api/makers/${m.id}`, {
                method: "PUT",
                body: JSON.stringify({ [field]: value || null }),
              })
            );
          }
        }}
      />
    );
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/makers", {
        method: "POST",
        body: JSON.stringify({
          makerCode: form.makerCode,
          nameJp: form.nameJp,
          nameEn: form.nameEn || null,
          imgFolder: form.imgFolder || null,
        }),
      });
      setForm({ makerCode: "", nameJp: "", nameEn: "", imgFolder: "" });
      setShowAdd(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>メーカーマスタ</h2>
        <span className="muted">名称・フォルダはセルをクリックして直接編集できます</span>
        <div style={{ marginLeft: "auto" }}>
          <button className="primary" onClick={() => setShowAdd(true)}>
            ＋ メーカー追加
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      <table>
        <thead>
          <tr>
            <th style={{ width: 90 }}>コード</th>
            <th>メーカー名</th>
            <th>英字名</th>
            <th>画像フォルダ</th>
            <th style={{ width: 90 }}>商品数</th>
          </tr>
        </thead>
        <tbody>
          {makers.map((m) => (
            <tr key={m.id}>
              <td>{m.makerCode}</td>
              <td>{editableCell(m, "nameJp", true)}</td>
              <td>{editableCell(m, "nameEn")}</td>
              <td>{editableCell(m, "imgFolder")}</td>
              <td className="num">{m._count?.products ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {showAdd && (
        <Modal title="メーカー追加" onClose={() => setShowAdd(false)}>
          <form onSubmit={submitAdd}>
            <div className="field">
              <label>メーカーコード *</label>
              <input
                required
                autoFocus
                placeholder="例: OD, AW（CFは1文字コード）"
                value={form.makerCode}
                onChange={(e) => setForm({ ...form, makerCode: e.target.value })}
                style={{ width: "100%" }}
              />
            </div>
            <div className="field">
              <label>メーカー名（和名） *</label>
              <input
                required
                value={form.nameJp}
                onChange={(e) => setForm({ ...form, nameJp: e.target.value })}
                style={{ width: "100%" }}
              />
            </div>
            <div className="field">
              <label>英字名</label>
              <input
                value={form.nameEn}
                onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                style={{ width: "100%" }}
              />
            </div>
            <div className="field">
              <label>画像フォルダ</label>
              <input
                value={form.imgFolder}
                onChange={(e) => setForm({ ...form, imgFolder: e.target.value })}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setShowAdd(false)}>
                キャンセル
              </button>
              <button type="submit" className="primary" disabled={saving}>
                {saving ? "追加中…" : "追加する"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
