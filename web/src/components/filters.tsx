import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ---- カラムごとの絞り込み用の小型フィルタ部品 ----

// テキスト（部分一致）: 入力は下書き、Enterで適用（onApply）
export function TextFilter({
  value,
  onChange,
  onApply,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onApply?: (v: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      className="col-filter-input"
      value={draft}
      placeholder={placeholder ?? "絞り込み⏎"}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onChange(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onApply ? onApply(draft) : (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

// 数値範囲: 入力は下書き、Enterで適用（onApply）
export function RangeFilter({
  min,
  max,
  onChange,
  onApply,
}: {
  min: string;
  max: string;
  onChange: (min: string, max: string) => void;
  onApply?: (min: string, max: string) => void;
}) {
  const [dMin, setDMin] = useState(min);
  const [dMax, setDMax] = useState(max);
  useEffect(() => setDMin(min), [min]);
  useEffect(() => setDMax(max), [max]);
  const commit = () => {
    if (dMin !== min || dMax !== max) onChange(dMin, dMax);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (onApply) onApply(dMin, dMax);
      else (e.target as HTMLInputElement).blur();
    }
  };
  return (
    <span className="range-filter">
      <input
        type="number"
        className="col-filter-input"
        placeholder="最小"
        value={dMin}
        onChange={(e) => setDMin(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
      />
      <span className="muted">〜</span>
      <input
        type="number"
        className="col-filter-input"
        placeholder="最大"
        value={dMax}
        onChange={(e) => setDMax(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
      />
    </span>
  );
}

// 日付範囲: 変更は下書き、Enterまたは変更時のonApplyで適用
export function DateRangeFilter({
  from,
  to,
  onApply,
}: {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
}) {
  const [dFrom, setDFrom] = useState(from);
  const [dTo, setDTo] = useState(to);
  useEffect(() => setDFrom(from), [from]);
  useEffect(() => setDTo(to), [to]);
  return (
    <span className="range-filter">
      <input
        type="date"
        className="col-filter-input"
        value={dFrom}
        onChange={(e) => {
          setDFrom(e.target.value);
          onApply(e.target.value, dTo);
        }}
      />
      <span className="muted">〜</span>
      <input
        type="date"
        className="col-filter-input"
        value={dTo}
        onChange={(e) => {
          setDTo(e.target.value);
          onApply(dFrom, e.target.value);
        }}
      />
    </span>
  );
}

export type FilterOption = { value: string | number; label: string };

// 項目選択（複数チェック）。候補は開いたときに取得。適用はパネル内の「適用」ボタンで行う
export function MultiFilter({
  selected,
  onChange,
  onApply,
  loadOptions,
}: {
  selected: Array<string | number>;
  onChange: (values: Array<string | number>) => void;
  onApply?: () => void;
  loadOptions: () => Promise<FilterOption[]>;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<FilterOption[] | null>(null);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // パネルはテーブルのスクロールコンテナにクリップされないよう body 直下に fixed で描画する
  function openPanel() {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      const width = 240;
      const left = Math.min(rect.left, window.innerWidth - width - 12);
      setPos({ top: rect.bottom + 4, left: Math.max(8, left) });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    if (options === null) {
      loadOptions()
        .then(setOptions)
        .catch(() => setOptions([]));
    }
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onScroll(e: Event) {
      // パネル内のスクロールは無視。ページ側がスクロールしたら位置がずれるため閉じる
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, options, loadOptions]);

  const selectedSet = new Set(selected.map(String));
  const filtered = (options ?? []).filter(
    (o) => !search || o.label.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(v: string | number) {
    const key = String(v);
    const next = selectedSet.has(key)
      ? selected.filter((s) => String(s) !== key)
      : [...selected, v];
    onChange(next);
  }

  return (
    <div className="multi-filter" ref={ref}>
      <button
        type="button"
        className={`col-filter-btn ${selected.length > 0 ? "filtering" : ""}`}
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        {selected.length > 0 ? `${selected.length}件選択` : "すべて"} ▾
      </button>
      {open &&
        createPortal(
        <div
          ref={panelRef}
          className="multi-filter-panel"
          style={{ position: "fixed", top: pos.top, left: pos.left }}
        >
          {(options?.length ?? 0) > 12 && (
            <input
              className="col-filter-input"
              placeholder="検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", marginBottom: 6 }}
            />
          )}
          <div className="multi-filter-list">
            {options === null && <div className="muted">読み込み中…</div>}
            {filtered.map((o) => (
              <label key={String(o.value)} className="column-panel-item">
                <input
                  type="checkbox"
                  checked={selectedSet.has(String(o.value))}
                  onChange={() => toggle(o.value)}
                />
                <span className="multi-filter-label">{o.label}</span>
              </label>
            ))}
            {options !== null && filtered.length === 0 && (
              <div className="muted">候補がありません</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              type="button"
              style={{ flex: 1 }}
              disabled={selected.length === 0}
              onClick={() => onChange([])}
            >
              クリア
            </button>
            {onApply && (
              <button
                type="button"
                className="primary"
                style={{ flex: 1 }}
                onClick={() => {
                  setOpen(false);
                  onApply();
                }}
              >
                適用
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ---- 汎用モーダル ----

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
