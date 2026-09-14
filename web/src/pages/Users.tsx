import { useCallback, useEffect, useState } from "react";
import { api, ROLE_LABEL, type ManagedUser } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

export function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "EDITOR" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<ManagedUser[]>("/api/users").then(setUsers).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<unknown>, successMessage?: string) {
    setError("");
    setMessage("");
    try {
      await fn();
      if (successMessage) setMessage(successMessage);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await run(
      () => api("/api/users", { method: "POST", body: JSON.stringify(form) }),
      `${form.name} を追加しました`
    );
    setForm({ email: "", name: "", password: "", role: "EDITOR" });
    setSaving(false);
  }

  function resetPassword(u: ManagedUser) {
    const password = prompt(`${u.name} の新しいパスワード（8文字以上）を入力してください`);
    if (!password) return;
    run(
      () =>
        api(`/api/users/${u.id}/reset-password`, {
          method: "POST",
          body: JSON.stringify({ password }),
        }),
      `${u.name} のパスワードを再設定しました`
    );
  }

  return (
    <div>
      <h2>ユーザー管理</h2>
      {error && <div className="error">{error}</div>}
      {message && <div style={{ color: "#166534", padding: "8px 0" }}>{message}</div>}

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>ユーザー追加</h3>
        <form onSubmit={submit} className="toolbar" style={{ marginBottom: 0 }}>
          <input
            type="email"
            required
            placeholder="メールアドレス"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={{ width: 220 }}
          />
          <input
            required
            placeholder="氏名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="初期パスワード（8文字以上）"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            style={{ width: 200 }}
          />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="EDITOR">編集者</option>
            <option value="ADMIN">管理者</option>
          </select>
          <button type="submit" className="primary" disabled={saving}>
            追加
          </button>
        </form>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>メールアドレス</th>
            <th>氏名</th>
            <th>権限</th>
            <th>状態</th>
            <th>最終ログイン</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isSelf = u.id === me?.id;
            return (
              <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
                <td>{u.id}</td>
                <td>
                  {u.email}
                  {isSelf && <span className="badge" style={{ marginLeft: 6 }}>自分</span>}
                </td>
                <td>{u.name}</td>
                <td>
                  <select
                    value={u.role}
                    disabled={isSelf}
                    onChange={(e) =>
                      run(
                        () =>
                          api(`/api/users/${u.id}`, {
                            method: "PUT",
                            body: JSON.stringify({ role: e.target.value }),
                          }),
                        "権限を変更しました"
                      )
                    }
                  >
                    <option value="EDITOR">{ROLE_LABEL.EDITOR}</option>
                    <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
                  </select>
                </td>
                <td>
                  <span className={`badge ${u.active ? "green" : "red"}`}>
                    {u.active ? "有効" : "無効"}
                  </span>
                </td>
                <td className="muted">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("ja-JP") : "-"}
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => resetPassword(u)}>PW再設定</button>
                  <button
                    disabled={isSelf}
                    className={u.active ? "danger" : ""}
                    onClick={() =>
                      run(
                        () =>
                          api(`/api/users/${u.id}`, {
                            method: "PUT",
                            body: JSON.stringify({ active: !u.active }),
                          }),
                        u.active ? "無効化しました" : "有効化しました"
                      )
                    }
                  >
                    {u.active ? "無効化" : "有効化"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted">
        無効化するとログインできなくなり、既存セッションも破棄されます（履歴保全のため削除はしません）。
      </p>
    </div>
  );
}
