import { useState } from "react";
import { api, ROLE_LABEL } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { Spinner } from "../components/Loading";

// 自分のアカウント(パスワード変更)。ほかの端末のログインは変更後に無効になる
export function Account() {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (form.newPassword.length < 8) {
      setError("新しいパスワードは8文字以上にしてください");
      return;
    }
    if (form.newPassword !== form.confirm) {
      setError("新しいパスワード(確認)が一致しません");
      return;
    }
    setSaving(true);
    try {
      await api("/api/auth/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
      setMessage("パスワードを変更しました。ほかの端末・ブラウザでは再ログインが必要です");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;
  return (
    <div>
      <h2>アカウント</h2>
      <div className="panel" style={{ maxWidth: 520 }}>
        <div className="field">
          <label>氏名</label>
          <div>{user.name}</div>
        </div>
        <div className="field">
          <label>メールアドレス</label>
          <div>{user.email}</div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>権限</label>
          <div>{ROLE_LABEL[user.role]}</div>
        </div>
      </div>

      <h3>パスワード変更</h3>
      {error && <div className="error">{error}</div>}
      {message && <div style={{ color: "#166534", padding: "8px 0" }}>{message}</div>}
      <form onSubmit={submit} className="panel" style={{ maxWidth: 520 }}>
        <div className="field">
          <label>現在のパスワード</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          />
        </div>
        <div className="field">
          <label>新しいパスワード(8文字以上)</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          />
        </div>
        <div className="field">
          <label>新しいパスワード(確認)</label>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </div>
        <button type="submit" className="primary" disabled={saving}>
          {saving ? (
            <>
              <Spinner />
              変更中…
            </>
          ) : (
            "パスワードを変更"
          )}
        </button>
      </form>
    </div>
  );
}
