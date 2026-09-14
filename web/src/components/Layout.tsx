import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { ROLE_LABEL } from "../lib/api";

type NavItem = {
  to: string;
  label: string;
  end?: boolean;
  adminOnly?: boolean;
  activePrefix?: string; // このパス配下すべてでアクティブ表示（タブ内包ページ用）
};
type NavGroup = { key: string; label: string; items: NavItem[]; adminOnly?: boolean };

const NAV_GROUPS: NavGroup[] = [
  {
    key: "products",
    label: "商品管理",
    items: [
      // ペンダントライト/シーリングファン/すべて は一覧ページ内のタブで切替。
      // シート編集・商品登録は各一覧から遷移する（サブメニューには出さない）
      { to: "/products/pendant", label: "商品一覧", activePrefix: "/products" },
    ],
  },
  {
    key: "masters",
    label: "マスタ",
    items: [{ to: "/masters", label: "マスタ管理" }], // メーカーもマスタ管理内のタブに統合
  },
  {
    key: "channels",
    label: "連携",
    items: [
      { to: "/exports", label: "CSV出力" },
      { to: "/sync", label: "連携状況" },
      { to: "/channels", label: "連携先設定" },
    ],
  },
  {
    key: "system",
    label: "システム管理",
    adminOnly: true,
    items: [
      { to: "/imports", label: "Excel取込", adminOnly: true },
      { to: "/users", label: "ユーザー管理", adminOnly: true },
    ],
  },
];

const STORAGE_KEY = "sidebar-collapsed-groups";

export function Layout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });

  // 現在ページを含むグループは自動展開
  useEffect(() => {
    // 詳細ページ（/products/123 等）でも親グループが開くよう前方一致で判定
    const activeGroup = NAV_GROUPS.find((g) =>
      g.items.some((i) => location.pathname.startsWith(i.to))
    );
    if (activeGroup && collapsed.has(activeGroup.key)) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(activeGroup.key);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="logo">商品管理</h1>
        <nav>
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            ダッシュボード
          </NavLink>
          {NAV_GROUPS.filter((g) => !g.adminOnly || user.role === "ADMIN").map((g) => {
            const isCollapsed = collapsed.has(g.key);
            return (
              <div key={g.key} className="nav-group">
                <button
                  type="button"
                  className="nav-group-header"
                  onClick={() => toggleGroup(g.key)}
                  aria-expanded={!isCollapsed}
                >
                  <span className={`caret ${isCollapsed ? "" : "open"}`}>▸</span>
                  {g.label}
                </button>
                {!isCollapsed &&
                  g.items
                    .filter((i) => !i.adminOnly || user.role === "ADMIN")
                    .map((i) => (
                      <NavLink
                        key={i.to}
                        to={i.to}
                        end={i.end}
                        className={({ isActive }) => {
                          const active = i.activePrefix
                            ? location.pathname.startsWith(i.activePrefix)
                            : isActive;
                          return active ? "nav-link child active" : "nav-link child";
                        }}
                      >
                        {i.label}
                      </NavLink>
                    ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div>{user.name}</div>
            <div className="muted-dark">{ROLE_LABEL[user.role]}</div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            ログアウト
          </button>
          <div style={{ marginTop: 12 }}>PL / CF 統合基幹DB</div>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
