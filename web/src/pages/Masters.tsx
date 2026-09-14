import { useCallback, useEffect, useState } from "react";
import { api, type Maker } from "../lib/api";
import { Modal } from "../components/filters";

// ---- メーカーマスタ（項目マスタと同じUI: 一覧＋モーダルで追加・編集） ----

function MakersPanel({ onError }: { onError: (m: string) => void }) {
  const [makers, setMakers] = useState<Maker[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editMaker, setEditMaker] = useState<Maker | null>(null);
  const [form, setForm] = useState({ makerCode: "", nameJp: "", nameEn: "", imgFolder: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<Maker[]>("/api/makers").then(setMakers).catch((e) => onError(e.message));
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setForm({ makerCode: "", nameJp: "", nameEn: "", imgFolder: "" });
    setShowAdd(true);
  }

  function openEdit(m: Maker) {
    setForm({
      makerCode: m.makerCode,
      nameJp: m.nameJp,
      nameEn: m.nameEn ?? "",
      imgFolder: m.imgFolder ?? "",
    });
    setEditMaker(m);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    onError("");
    try {
      const payload = {
        nameJp: form.nameJp,
        nameEn: form.nameEn || null,
        imgFolder: form.imgFolder || null,
      };
      if (editMaker) {
        await api(`/api/makers/${editMaker.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setEditMaker(null);
      } else {
        await api("/api/makers", {
          method: "POST",
          body: JSON.stringify({ makerCode: form.makerCode, ...payload }),
        });
        setShowAdd(false);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
    setSaving(false);
    load();
  }

  const modalOpen = showAdd || editMaker != null;

  return (
    <>
      <div className="toolbar">
        <button className="primary" onClick={openAdd}>
          ＋ メーカーを追加
        </button>
      </div>
      <table style={{ maxWidth: 900 }}>
        <thead>
          <tr>
            <th style={{ width: 90 }}>コード</th>
            <th>メーカー名</th>
            <th>英字名</th>
            <th>画像フォルダ</th>
            <th style={{ width: 90 }}>商品数</th>
            <th style={{ width: 80 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {makers.map((m) => (
            <tr key={m.id}>
              <td>{m.makerCode}</td>
              <td>{m.nameJp}</td>
              <td>{m.nameEn ?? "-"}</td>
              <td>{m.imgFolder ?? "-"}</td>
              <td className="num">{m._count?.products ?? 0}</td>
              <td>
                <button onClick={() => openEdit(m)}>編集</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalOpen && (
        <Modal
          title={editMaker ? `メーカーの編集（${editMaker.makerCode}）` : "メーカーの追加"}
          onClose={() => {
            setShowAdd(false);
            setEditMaker(null);
          }}
        >
          <form onSubmit={save}>
            {!editMaker && (
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
            )}
            <div className="field">
              <label>メーカー名（和名） *</label>
              <input
                required
                autoFocus={!!editMaker}
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
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setEditMaker(null);
                }}
              >
                キャンセル
              </button>
              <button type="submit" className="primary" disabled={saving}>
                {saving ? "保存中…" : editMaker ? "保存" : "追加する"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export const MASTER_TYPE_LABEL: Record<string, string> = {
  supplier: "仕入先",
  installation_type: "取付タイプ",
  bulb_base: "口金",
  bulb_color: "電球色",
  light_color: "光色",
  body_color: "本体カラー",
  material: "素材",
  warranty: "保証期間",
  motor_type: "モーター(AC/DC)",
};

const MASTER_TYPES = Object.keys(MASTER_TYPE_LABEL);

type MasterItem = {
  id: number;
  type: string;
  value: string;
  active: boolean;
  note: string | null;
};

type TypeCount = { type: string; count: number };

export function Masters() {
  const [currentType, setCurrentType] = useState("maker");
  const [counts, setCounts] = useState<TypeCount[]>([]);
  const [items, setItems] = useState<MasterItem[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // 追加モーダル
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ value: "", note: "" });

  // 編集モーダル
  const [editItem, setEditItem] = useState<MasterItem | null>(null);
  const [editForm, setEditForm] = useState({ value: "", note: "" });

  const load = useCallback(() => {
    if (currentType === "maker") return; // メーカータブは MakersPanel が自前で取得
    api<MasterItem[]>(`/api/masters?type=${currentType}`)
      .then(setItems)
      .catch((e) => setError(e.message));
    api<TypeCount[]>("/api/masters/types").then(setCounts).catch(() => {});
  }, [currentType]);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setAddForm({ value: "", note: "" });
    setShowAdd(true);
  }

  async function saveAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.value.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api("/api/masters", {
        method: "POST",
        body: JSON.stringify({
          type: currentType,
          value: addForm.value.trim(),
          note: addForm.note || null,
        }),
      });
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setSaving(false);
    load();
  }

  function openEdit(item: MasterItem) {
    setEditItem(item);
    setEditForm({ value: item.value, note: item.note ?? "" });
  }

  async function saveEdit() {
    if (!editItem || !editForm.value.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api(`/api/masters/${editItem.id}`, {
        method: "PUT",
        body: JSON.stringify({
          value: editForm.value.trim(),
          note: editForm.note || null,
        }),
      });
      setEditItem(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setSaving(false);
    load();
  }

  async function toggleActive() {
    if (!editItem) return;
    setSaving(true);
    setError("");
    try {
      await api(`/api/masters/${editItem.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !editItem.active }),
      });
      setEditItem(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setSaving(false);
    load();
  }

  return (
    <div>
      <h2>マスタ管理</h2>
      <p className="muted">
        商品データから抽出した語彙を管理します。値の変更はマスタ（今後の入力候補）にのみ反映され、登録済み商品の値は書き換えません。
      </p>
      {error && <div className="error">{error}</div>}

      <div className="tabs" style={{ flexWrap: "wrap" }}>
        <button
          className={`tab ${currentType === "maker" ? "active" : ""}`}
          onClick={() => setCurrentType("maker")}
        >
          メーカー
        </button>
        {MASTER_TYPES.map((t) => (
          <button
            key={t}
            className={`tab ${currentType === t ? "active" : ""}`}
            onClick={() => setCurrentType(t)}
          >
            {MASTER_TYPE_LABEL[t]}
            <span className="muted" style={{ marginLeft: 4, fontSize: 11 }}>
              {counts.find((c) => c.type === t)?.count ?? ""}
            </span>
          </button>
        ))}
      </div>

      {currentType === "maker" && <MakersPanel onError={setError} />}
      {currentType !== "maker" && (
      <>
      <div className="toolbar">
        <button className="primary" onClick={openAdd}>
          ＋ {MASTER_TYPE_LABEL[currentType]} を追加
        </button>
      </div>

      <table style={{ maxWidth: 760 }}>
        <thead>
          <tr>
            <th>値</th>
            <th>メモ</th>
            <th style={{ width: 70 }}>状態</th>
            <th style={{ width: 80 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ opacity: item.active ? 1 : 0.45 }}>
              <td>{item.value}</td>
              <td className="muted">{item.note ?? "-"}</td>
              <td>
                <span className={`badge ${item.active ? "green" : "red"}`}>
                  {item.active ? "有効" : "無効"}
                </span>
              </td>
              <td>
                <button onClick={() => openEdit(item)}>編集</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                データがありません
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showAdd && (
        <Modal
          title={`${MASTER_TYPE_LABEL[currentType]} の追加`}
          onClose={() => setShowAdd(false)}
        >
          <form onSubmit={saveAdd}>
            <div className="field">
              <label>値 *</label>
              <input
                required
                autoFocus
                value={addForm.value}
                onChange={(e) => setAddForm({ ...addForm, value: e.target.value })}
                style={{ width: "100%" }}
              />
            </div>
            <div className="field">
              <label>メモ</label>
              <input
                value={addForm.note}
                onChange={(e) => setAddForm({ ...addForm, note: e.target.value })}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setShowAdd(false)}>
                キャンセル
              </button>
              <button type="submit" className="primary" disabled={saving || !addForm.value.trim()}>
                {saving ? "追加中…" : "追加する"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editItem && (
        <Modal
          title={`${MASTER_TYPE_LABEL[editItem.type] ?? editItem.type} の編集`}
          onClose={() => setEditItem(null)}
        >
          <div className="field">
            <label>値 *</label>
            <input
              required
              autoFocus
              value={editForm.value}
              onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
              style={{ width: "100%" }}
            />
          </div>
          <div className="field">
            <label>メモ</label>
            <input
              value={editForm.note}
              onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
              style={{ width: "100%" }}
            />
          </div>
          <div className="field">
            <label>状態</label>
            <span className={`badge ${editItem.active ? "green" : "red"}`}>
              {editItem.active ? "有効" : "無効"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className={editItem.active ? "danger" : ""} onClick={toggleActive} disabled={saving}>
              {editItem.active ? "無効化" : "有効化"}
            </button>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={() => setEditItem(null)}>キャンセル</button>
              <button
                className="primary"
                onClick={saveEdit}
                disabled={saving || !editForm.value.trim()}
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      </>
      )}
    </div>
  );
}
