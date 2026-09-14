import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  api,
  CATEGORY_LABEL,
  KIND_LABEL,
  Maker,
  Paged,
  Product,
  STATUS_LABEL,
  yen,
} from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { clearMarks, getMarks, toggleMark } from "../lib/marks";
import { DateRangeFilter, MultiFilter, RangeFilter, TextFilter, type FilterOption } from "../components/filters";

const statusBadge: Record<string, string> = {
  ACTIVE: "green",
  DISCONTINUED: "red",
  DISCONTINUED_IN_STOCK: "amber",
  BACKORDER: "amber",
  RESERVE: "gray",
  HIDDEN: "gray",
};

// 一覧タブ。項目が異なるため「すべて」は設けない。
// ペンダントライトタブは同じ照明属性を持つシーリングライトを含む（現行PLブックの構成に対応）
type TabKey = "PENDANT_LIGHT" | "CEILING_FAN";
const TAB_CATEGORIES: Record<TabKey, string[]> = {
  PENDANT_LIGHT: ["PENDANT_LIGHT", "CEILING_LIGHT"],
  CEILING_FAN: ["CEILING_FAN"],
};

type ProductListProps = { fixedCategory: TabKey };

// ---- 表示列の定義（表示項目カスタマイズ＋カラムごとの絞り込み） ----

function attr(obj: Record<string, unknown> | null | undefined, key: string): string {
  const v = obj?.[key];
  if (v === true) return "○";
  if (v === false) return "-";
  return v == null || v === "" ? "-" : String(v);
}

type ColumnFilter =
  | { kind: "text"; param: string }
  | {
      kind: "multi";
      param: string;
      options: "makers" | { static: Record<string, string> } | { facet: string };
      numeric?: boolean;
    }
  | { kind: "range"; paramMin: string; paramMax: string }
  | { kind: "daterange"; paramFrom: string; paramTo: string };

type ColumnDef = {
  key: string;
  label: string;
  group: string;
  sortKey?: string;
  defaultOn?: boolean;
  scope?: "PL" | "CF"; // 未指定=両タブ
  className?: string;
  render: (p: Product) => React.ReactNode;
  filter?: ColumnFilter;
};

// products のフラット列
function productCol(
  key: keyof Product & string,
  label: string,
  group: string,
  opts: Partial<ColumnDef> = {}
): ColumnDef {
  return {
    key,
    label,
    group,
    render: (p) => {
      const v = p[key as keyof Product];
      if (v === true) return "○";
      if (v === false) return "-";
      return v == null || v === "" ? "-" : String(v);
    },
    ...opts,
  };
}

function lightingCol(key: string, label: string, opts: Partial<ColumnDef> = {}): ColumnDef {
  return {
    key: `l_${key}`,
    label,
    group: "照明属性",
    scope: "PL",
    render: (p) => attr(p.lightingAttrs, key),
    ...opts,
  };
}

function fanCol(key: string, label: string, opts: Partial<ColumnDef> = {}): ColumnDef {
  return {
    key: `f_${key}`,
    label,
    group: "ファン属性",
    scope: "CF",
    render: (p) => attr(p.fanAttrs, key),
    ...opts,
  };
}

const COLUMNS: ColumnDef[] = [
  // ---- 基本 ----
  {
    // 種別はタブで絞り込むためフィルタは持たない（PLタブ内のPL/CL区別の表示用のみ）
    key: "category",
    label: "種別",
    group: "基本",
    sortKey: "category",
    render: (p) => <span className="badge gray">{CATEGORY_LABEL[p.category]}</span>,
  },
  {
    key: "name",
    label: "商品名",
    group: "基本",
    sortKey: "name",
    defaultOn: true,
    render: (p) => (
      <div style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
    ),
    filter: { kind: "text", param: "name" },
  },
  {
    key: "maker",
    label: "メーカー",
    group: "基本",
    sortKey: "maker",
    defaultOn: true,
    render: (p) => p.maker?.nameJp ?? "-",
    filter: { kind: "multi", param: "makerIds", options: "makers", numeric: true },
  },
  {
    key: "kind",
    label: "区分",
    group: "基本",
    sortKey: "productKind",
    defaultOn: true,
    render: (p) => KIND_LABEL[p.productKind],
    filter: { kind: "multi", param: "kinds", options: { static: KIND_LABEL } },
  },
  productCol("summary", "商品概要", "基本"),
  productCol("modelNumber", "本体型番", "基本", { filter: { kind: "text", param: "modelNumber" } }),
  productCol("combinationModel", "組み合わせ型番", "基本"),
  productCol("janCode", "JAN", "基本", { filter: { kind: "text", param: "janCode" } }),
  productCol("supplier", "仕入先", "基本", {
    filter: { kind: "multi", param: "suppliers", options: { facet: "supplier" } },
  }),
  productCol("bodyColor", "本体カラー", "基本", {
    filter: { kind: "multi", param: "bodyColors", options: { facet: "bodyColor" } },
  }),
  {
    key: "status",
    label: "状態",
    group: "基本",
    sortKey: "status",
    defaultOn: true,
    render: (p) => (
      <span className={`badge ${statusBadge[p.status] ?? "gray"}`}>
        {STATUS_LABEL[p.status] ?? p.status}
      </span>
    ),
    filter: { kind: "multi", param: "statuses", options: { static: STATUS_LABEL } },
  },
  productCol("statusNote", "状態メモ", "基本"),
  productCol("successorModel", "後継機種", "基本"),
  {
    key: "skuStock",
    label: "SKU/在庫",
    group: "基本",
    defaultOn: true,
    className: "num",
    render: (p) => `${p.variations.length} / ${p.variations.reduce((a, v) => a + v.stockQty, 0)}`,
  },
  {
    key: "updatedAt",
    label: "更新日時",
    group: "基本",
    sortKey: "updatedAt",
    defaultOn: true,
    filter: { kind: "daterange", paramFrom: "updatedFrom", paramTo: "updatedTo" },
    render: (p) => (
      <span className="muted">
        {new Date(p.updatedAt).toLocaleString("ja-JP", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    ),
  },
  // ---- 価格 ----
  {
    key: "cost",
    label: "仕入値(税抜)",
    group: "価格",
    className: "num",
    render: (p) => yen(p.cost),
    filter: { kind: "range", paramMin: "costMin", paramMax: "costMax" },
  },
  {
    key: "listPriceExTax",
    label: "定価(税抜)",
    group: "価格",
    className: "num",
    render: (p) => yen(p.listPriceExTax),
    filter: { kind: "range", paramMin: "listPriceMin", paramMax: "listPriceMax" },
  },
  {
    key: "listPriceInTax",
    label: "定価(税込)",
    group: "価格",
    className: "num",
    render: (p) => yen((p as unknown as { listPriceInTax: number | null }).listPriceInTax),
  },
  {
    key: "sellingPrice",
    label: "販売価格(税込)",
    group: "価格",
    className: "num",
    render: (p) => yen(p.sellingPrice),
  },
  {
    key: "price",
    label: "販売価格",
    group: "価格",
    sortKey: "totalPrice",
    defaultOn: true,
    className: "num",
    render: (p) => yen(p.totalPrice ?? p.sellingPrice),
    filter: { kind: "range", paramMin: "priceMin", paramMax: "priceMax" },
  },
  // ---- 寸法・共通 ----
  productCol("widthMm", "幅(mm)", "寸法・共通", { className: "num" }),
  productCol("depthMm", "奥行(mm)", "寸法・共通", { className: "num" }),
  productCol("heightMm", "高さ(mm)", "寸法・共通", { className: "num" }),
  productCol("weightKg", "重量(kg)", "寸法・共通", { className: "num" }),
  productCol("warranty", "保証期間", "寸法・共通"),
  productCol("countryOfOrigin", "生産国", "寸法・共通"),
  productCol("goodDesignYear", "GoodDesign", "寸法・共通", { className: "num" }),
  // ---- 運用 ----
  productCol("isNew", "新着", "運用"),
  productCol("isRecommended", "おすすめ", "運用"),
  productCol("isSameDayShipping", "即日発送", "運用"),
  productCol("sortNo", "並び順", "運用", { className: "num" }),
  productCol("shippingLeadTime", "出荷納期", "運用"),
  productCol("fsShippingPattern", "FS送料パターン", "運用"),
  productCol("memo", "メモ", "運用"),
  // ---- 照明属性（PLタブ） ----
  lightingCol("installationType", "取付", {
    defaultOn: true,
    filter: { kind: "multi", param: "installationTypes", options: { facet: "installationType" } },
  }),
  lightingCol("bulbColor", "電球色", {
    defaultOn: true,
    filter: { kind: "multi", param: "bulbColors", options: { facet: "bulbColor" } },
  }),
  lightingCol("tatami", "畳数", {
    defaultOn: true,
    filter: { kind: "multi", param: "tatamis", options: { facet: "tatami" } },
  }),
  lightingCol("bulbBase", "口金", {
    filter: { kind: "multi", param: "bulbBases", options: { facet: "bulbBase" } },
  }),
  lightingCol("bulbType", "電球タブ"),
  lightingCol("bulbKind", "電球種類"),
  lightingCol("initialBulbType", "初期電球"),
  lightingCol("mainBulbCount", "電球数", { className: "num" }),
  lightingCol("bulbReplacement", "電球交換"),
  lightingCol("brightnessLm", "明るさ(lm)"),
  lightingCol("colorTempLow", "色温度1(K)", { className: "num" }),
  lightingCol("colorTempHigh", "色温度2(K)", { className: "num" }),
  lightingCol("raValue", "Ra", { className: "num" }),
  lightingCol("wattEquivalent", "W相当"),
  lightingCol("dimmingMethod", "調光方法"),
  lightingCol("stepSwitching", "段階切替"),
  lightingCol("pullSwitch", "プルスイッチ"),
  lightingCol("remoteIncluded", "リモコン付属"),
  lightingCol("inclinedCeiling", "傾斜対応"),
  lightingCol("highCeiling", "高所天井"),
  lightingCol("cordStorage", "コード収納"),
  lightingCol("material", "素材"),
  // ---- ファン属性（CFタブ） ----
  fanCol("motorType", "AC/DC", {
    defaultOn: true,
    filter: { kind: "multi", param: "motorTypes", options: { facet: "motorType" } },
  }),
  fanCol("bladeCount", "羽根", {
    defaultOn: true,
    className: "num",
    filter: { kind: "multi", param: "bladeCounts", options: { facet: "bladeCount" }, numeric: true },
  }),
  {
    key: "f_tatamiRange",
    label: "畳数",
    group: "ファン属性",
    scope: "CF",
    defaultOn: true,
    render: (p) => {
      const from = p.fanAttrs?.["tatamiFrom"];
      const to = p.fanAttrs?.["tatamiTo"];
      if (from == null && to == null) return "-";
      return `${from ?? ""}〜${to ?? ""}`;
    },
  },
  fanCol("bladeColor1", "羽の色", {
    filter: { kind: "multi", param: "bladeColors", options: { facet: "bladeColor1" } },
  }),
  fanCol("bladeColor2", "羽の色②"),
  fanCol("windSpeed", "風速(m/s)", { className: "num" }),
  fanCol("windVolume", "風量(m3/min)", { className: "num" }),
  fanCol("rotationSpeed", "回転数", { className: "num" }),
  fanCol("windLevels", "風量レベル", { className: "num" }),
  fanCol("powerConsumptionW", "消費電力(W)", { className: "num" }),
  fanCol("extensionPipe", "延長パイプ"),
  fanCol("mountType", "取付(直付/パイプ)"),
  fanCol("heightToBladeMm", "羽根まで高さ", { className: "num" }),
  fanCol("lightCount", "照明数", { className: "num" }),
  fanCol("lightKind", "照明種類"),
  fanCol("lightColor", "光色"),
  fanCol("colorCategory", "カラー種別"),
  fanCol("rhythmMode", "リズム回転"),
  fanCol("dimming", "調光"),
  fanCol("remoteIncluded", "リモコン"),
  fanCol("batteryType", "電池"),
  fanCol("batteryCount", "電池数", { className: "num" }),
  fanCol("brightnessLm", "照度(lm)", { className: "num" }),
  fanCol("angledCeiling", "斜め取付"),
  fanCol("fanGrade", "グレード"),
];

const COLUMN_GROUPS = ["基本", "価格", "寸法・共通", "運用", "照明属性", "ファン属性"];

function columnsForTab(tab: TabKey): ColumnDef[] {
  return COLUMNS.filter((c) => {
    if (c.scope === "PL") return tab === "PENDANT_LIGHT";
    if (c.scope === "CF") return tab === "CEILING_FAN";
    return true;
  });
}

export function ProductList({ fixedCategory }: ProductListProps) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<Paged<Product> | null>(null);
  const [error, setError] = useState("");
  const [marks, setMarks] = useState<Set<string>>(() => (user ? getMarks(user.id) : new Set()));
  // 親行の展開（子バリエーションのインライン表示）
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const page = Number(params.get("page") ?? 1);
  const markedOnly = params.get("marked") === "1";
  const showChildren = params.get("children") === "1"; // 全行で子SKUを表示
  const sort = params.get("sort") ?? ""; // 空=ソートなし（サーバ既定: 更新日時の新しい順）
  const order = params.get("order") ?? "asc";
  const tabCategories = TAB_CATEGORIES[fixedCategory];

  // ---- カラムごとの絞り込み ----
  // 適用済み条件はURLパラメータ f にJSONで保持。
  // 入力は下書き（draftFilters）に溜め、「フィルタ適用」ボタンで反映する（スプレッドシートと同じ仕様）
  const fParam = params.get("f") ?? "";
  const colFilters = useMemo((): Record<string, unknown> => {
    try {
      return fParam ? JSON.parse(fParam) : {};
    } catch {
      return {};
    }
  }, [fParam]);

  const [draftFilters, setDraftFilters] = useState<Record<string, unknown>>(colFilters);
  useEffect(() => {
    setDraftFilters(colFilters); // タブ切替・戻る等でURL側が変わったら下書きも同期
  }, [colFilters]);

  function prune(obj: Record<string, unknown>): Record<string, unknown> {
    const next = { ...obj };
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) delete next[k];
    }
    return next;
  }

  function setDraft(updates: Record<string, unknown>) {
    setDraftFilters((prev) => prune({ ...prev, ...updates }));
  }

  // 適用（各絞り込みUIの「適用」ボタン/Enterから呼ぶ）。extra はその場の入力値を合流させる
  function applyFilters(extra?: Record<string, unknown>) {
    const next = prune({ ...draftFilters, ...(extra ?? {}) });
    setDraftFilters(next);
    const nextParams = new URLSearchParams(params);
    if (Object.keys(next).length > 0) nextParams.set("f", JSON.stringify(next));
    else nextParams.delete("f");
    nextParams.delete("page");
    setParams(nextParams);
  }

  function clearColFilters() {
    setDraftFilters({});
    const nextParams = new URLSearchParams(params);
    nextParams.delete("f");
    nextParams.delete("page");
    setParams(nextParams);
  }

  // ---- 表示項目カスタマイズ（ユーザーごとにサーバ保存） ----
  const settingKey = `productListColumns:${fixedCategory}`;
  const available = columnsForTab(fixedCategory);
  const defaults = available.filter((c) => c.defaultOn).map((c) => c.key);
  const [visibleKeys, setVisibleKeys] = useState<string[] | null>(null);
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleKeys(null);
    api<{ value: string[] | null }>(`/api/settings/${settingKey}`)
      .then((s) => setVisibleKeys(s.value ?? null))
      .catch(() => setVisibleKeys(null));
  }, [settingKey]);

  useEffect(() => {
    if (!showColumnPanel) return;
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowColumnPanel(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [showColumnPanel]);

  // 保存配列の順序＝列の表示順（ドラッグ&ドロップの並び替えもここに保存）
  const availableByKey = new Map(available.map((c) => [c.key, c]));
  const currentKeys = (visibleKeys ?? defaults).filter((k) => availableByKey.has(k));
  const visibleSet = new Set(currentKeys);
  const visibleCols = currentKeys.map((k) => availableByKey.get(k)!) as ColumnDef[];
  const isCustomized = visibleKeys != null;

  function saveKeys(keys: string[]) {
    setVisibleKeys(keys);
    api(`/api/settings/${settingKey}`, {
      method: "PUT",
      body: JSON.stringify({ value: keys }),
    }).catch((e) => setError(e.message));
  }

  function toggleColumn(key: string) {
    // ONにした列は末尾に追加（既存の並びを保つ）
    saveKeys(visibleSet.has(key) ? currentKeys.filter((k) => k !== key) : [...currentKeys, key]);
  }

  // ---- 列ヘッダーのドラッグ&ドロップ並び替え ----
  const dragKeyRef = useRef<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  function dropColumn(targetKey: string) {
    const from = dragKeyRef.current;
    dragKeyRef.current = null;
    setDragOverKey(null);
    if (!from || from === targetKey) return;
    const keys = [...currentKeys];
    const fromIdx = keys.indexOf(from);
    const toIdx = keys.indexOf(targetKey);
    if (fromIdx < 0 || toIdx < 0) return;
    keys.splice(fromIdx, 1);
    // 左→右のドラッグはターゲットの右に、右→左は左に挿入（直感的な移動）
    const insertIdx = keys.indexOf(targetKey) + (fromIdx < toIdx ? 1 : 0);
    keys.splice(insertIdx, 0, from);
    saveKeys(keys);
  }

  function resetColumns() {
    setVisibleKeys(null);
    api(`/api/settings/${settingKey}`, { method: "DELETE" }).catch(() => {});
  }

  // ---- データ取得（カラム絞り込みがあるため常にPOST /search） ----
  const load = useCallback(() => {
    // 種別は常にタブが決める。カラム絞り込み側に categories が紛れても無視する
    // （ペンダントライトのタブにシーリングファンが混ざる事故を防ぐ）
    const { categories: _ignored, ...restFilters } = colFilters;
    const body: Record<string, unknown> = {
      categories: tabCategories,
      page,
      ...(sort && { sort, order }), // ソートなし時はサーバ既定（更新日時の新しい順）
      ...restFilters,
    };
    if (markedOnly) body.productCodes = user ? [...getMarks(user.id)] : [];
    api<Paged<Product>>("/api/products/search", { method: "POST", body: JSON.stringify(body) })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [params, page, sort, order, colFilters, markedOnly, user, tabCategories]);

  useEffect(() => {
    load();
  }, [load]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  }

  // 昇順 → 降順 → ソートなし の3状態で切り替え
  function toggleSort(key: string) {
    const next = new URLSearchParams(params);
    if (sort !== key) {
      next.set("sort", key);
      next.set("order", "asc");
    } else if (order === "asc") {
      next.set("order", "desc");
    } else {
      next.delete("sort");
      next.delete("order");
    }
    next.delete("page");
    setParams(next);
  }

  function renderSortTh(k: string, label: React.ReactNode, key?: string) {
    const active = sort === k;
    return (
      <th
        key={key ?? k}
        className={`sortable ${active ? "sorted" : ""}`}
        onClick={() => toggleSort(k)}
        title="クリックでソート（昇順→降順→解除）"
      >
        {label}
        <span className="sort-indicator">{active ? (order === "asc" ? "▲" : "▼") : "⇅"}</span>
      </th>
    );
  }

  // カラムフィルタのコントロール描画
  function filterOptionsLoader(f: ColumnFilter & { kind: "multi" }): () => Promise<FilterOption[]> {
    return async () => {
      if (f.options === "makers") {
        const ms = await api<Maker[]>("/api/makers");
        return ms.map((m) => ({ value: m.id, label: m.nameJp }));
      }
      if ("static" in f.options) {
        return Object.entries(f.options.static).map(([k, v]) => ({ value: k, label: v }));
      }
      const values = await api<Array<string | number>>(
        `/api/products/facets?field=${f.options.facet}&categories=${tabCategories.join(",")}`
      );
      return values.map((v) => ({ value: v, label: String(v) }));
    };
  }

  // 注意: コンポーネントとしてネスト定義すると再レンダーごとに別型となり
  // フィルタUIが作り直される（パネルが閉じ選択できなくなる）ため、通常の関数でJSXを返す
  function renderFilterCell(col: ColumnDef) {
    const f = col.filter;
    if (!f) return <th key={col.key} className="filter-cell" />;
    if (f.kind === "text") {
      return (
        <th key={col.key} className="filter-cell">
          <TextFilter
            value={(draftFilters[f.param] as string) ?? ""}
            onChange={(v) => setDraft({ [f.param]: v })}
            onApply={(v) => applyFilters({ [f.param]: v || undefined })}
          />
        </th>
      );
    }
    if (f.kind === "range") {
      return (
        <th key={col.key} className="filter-cell">
          <RangeFilter
            min={draftFilters[f.paramMin] != null ? String(draftFilters[f.paramMin]) : ""}
            max={draftFilters[f.paramMax] != null ? String(draftFilters[f.paramMax]) : ""}
            onChange={(min, max) =>
              setDraft({
                [f.paramMin]: min === "" ? undefined : Number(min),
                [f.paramMax]: max === "" ? undefined : Number(max),
              })
            }
            onApply={(min, max) =>
              applyFilters({
                [f.paramMin]: min === "" ? undefined : Number(min),
                [f.paramMax]: max === "" ? undefined : Number(max),
              })
            }
          />
        </th>
      );
    }
    if (f.kind === "daterange") {
      return (
        <th key={col.key} className="filter-cell">
          <DateRangeFilter
            from={(draftFilters[f.paramFrom] as string) ?? ""}
            to={(draftFilters[f.paramTo] as string) ?? ""}
            onApply={(from, to) =>
              applyFilters({
                [f.paramFrom]: from || undefined,
                [f.paramTo]: to || undefined,
              })
            }
          />
        </th>
      );
    }
    return (
      <th key={col.key} className="filter-cell">
        <MultiFilter
          selected={(draftFilters[f.param] as Array<string | number>) ?? []}
          onChange={(values) =>
            setDraft({
              [f.param]: f.numeric ? values.map(Number) : values,
            })
          }
          onApply={() => applyFilters()}
          loadOptions={filterOptionsLoader(f)}
        />
      </th>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;
  const colCount = 2 + visibleCols.length;
  const hasColFilters = Object.keys(colFilters).length > 0;

  // タブ切替時は共通フィルタを引き継ぎ、ページ番号はリセット
  const tabSearch = (() => {
    const next = new URLSearchParams(params);
    next.delete("page");
    const s = next.toString();
    return s ? `?${s}` : "";
  })();
  const tabs: Array<{ to: string; label: string; key: TabKey }> = [
    { to: "/products/pendant", label: "ペンダントライト", key: "PENDANT_LIGHT" },
    { to: "/products/fan", label: "シーリングファン", key: "CEILING_FAN" },
  ];

  return (
    <div>
      <h2>商品一覧</h2>
      <div className="tabs">
        {tabs.map((t) => (
          <Link
            key={t.key}
            to={`${t.to}${tabSearch}`}
            className={`tab ${fixedCategory === t.key ? "active" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <div className="toolbar">
        <label className="checkbox-filter">
          <input
            type="checkbox"
            checked={markedOnly}
            onChange={(e) => setFilter("marked", e.target.checked ? "1" : "")}
          />
          ★のみ
        </label>
        <label className="checkbox-filter" title="全商品の子SKU（バリエーション）を展開表示">
          <input
            type="checkbox"
            checked={showChildren}
            onChange={(e) => setFilter("children", e.target.checked ? "1" : "")}
          />
          子SKUも表示
        </label>
        <span className="muted">★ {marks.size} 件マーク中</span>
        {marks.size > 0 && (
          <button
            onClick={() => {
              if (!user) return;
              if (!confirm(`マーク ${marks.size} 件をすべてクリアしますか？`)) return;
              setMarks(new Set(clearMarks(user.id)));
              if (markedOnly) setFilter("marked", "");
            }}
          >
            クリア
          </button>
        )}
        {(hasColFilters || Object.keys(prune(draftFilters)).length > 0) && (
          <button onClick={clearColFilters}>絞り込み解除</button>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <div className="column-picker" ref={panelRef}>
            <button onClick={() => setShowColumnPanel((s) => !s)}>
              表示項目{isCustomized ? "＊" : ""} ▾
            </button>
            {showColumnPanel && (
              <div className="column-panel">
                <div className="muted" style={{ marginBottom: 6 }}>
                  ★・商品コードは常に表示。列の並び替えは列ヘッダーをドラッグ
                </div>
                {COLUMN_GROUPS.map((g) => {
                  const cols = available.filter((c) => c.group === g);
                  if (cols.length === 0) return null;
                  return (
                    <div key={g}>
                      <div className="column-panel-group">{g}</div>
                      {cols.map((c) => (
                        <label key={c.key} className="column-panel-item">
                          <input
                            type="checkbox"
                            checked={visibleSet.has(c.key)}
                            onChange={() => toggleColumn(c.key)}
                          />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  );
                })}
                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                  <button onClick={resetColumns} disabled={!isCustomized}>
                    既定に戻す
                  </button>
                  <button onClick={() => setShowColumnPanel(false)}>閉じる</button>
                </div>
              </div>
            )}
          </div>
          <Link to="/exports">
            <button>CSV出力</button>
          </Link>
          <Link to={`/products/sheet?category=${fixedCategory}`}>
            <button>シート編集</button>
          </Link>
          <Link to={`/products/new?category=${fixedCategory}`}>
            <button className="primary">＋ 商品登録</button>
          </Link>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="table-scroll">
      <table className="table-nowrap">
        <thead>
          <tr>
            <th title="マーク（CSV出力の絞り込みに使用）">★</th>
            {renderSortTh("productCode", "商品コード")}
            {visibleCols.map((c) => {
              const isSort = !!c.sortKey;
              const active = isSort && sort === c.sortKey;
              return (
                <th
                  key={c.key}
                  draggable
                  onDragStart={() => {
                    dragKeyRef.current = c.key;
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverKey(c.key);
                  }}
                  onDragLeave={() => setDragOverKey((k) => (k === c.key ? null : k))}
                  onDrop={(e) => {
                    e.preventDefault();
                    dropColumn(c.key);
                  }}
                  onDragEnd={() => {
                    dragKeyRef.current = null;
                    setDragOverKey(null);
                  }}
                  onClick={isSort ? () => toggleSort(c.sortKey!) : undefined}
                  className={`${isSort ? `sortable ${active ? "sorted" : ""}` : ""} ${
                    dragOverKey === c.key ? "drag-over" : ""
                  }`}
                  title={
                    isSort
                      ? "クリックでソート（昇順→降順→解除）／ドラッグで並び替え"
                      : "ドラッグで並び替え"
                  }
                >
                  {c.label}
                  {isSort && (
                    <span className="sort-indicator">
                      {active ? (order === "asc" ? "▲" : "▼") : "⇅"}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
          <tr className="filter-row">
            <th className="filter-cell" />
            <th className="filter-cell">
              <TextFilter
                value={(draftFilters.productCode as string) ?? ""}
                onChange={(v) => setDraft({ productCode: v })}
                onApply={(v) => applyFilters({ productCode: v || undefined })}
              />
            </th>
            {visibleCols.map((c) => renderFilterCell(c))}
          </tr>
        </thead>
        <tbody>
          {data?.items.map((p) => (
            <React.Fragment key={p.id}>
            <tr>
              <td>
                <button
                  className={`mark-btn ${marks.has(p.productCode) ? "marked" : ""}`}
                  title={marks.has(p.productCode) ? "マークを外す" : "マークする"}
                  onClick={() => {
                    if (!user) return;
                    setMarks(new Set(toggleMark(user.id, p.productCode)));
                    if (markedOnly) load();
                  }}
                >
                  {marks.has(p.productCode) ? "★" : "☆"}
                </button>
              </td>
              <td>
                <button
                  className="expand-btn"
                  title="バリエーション（子SKU）を表示"
                  onClick={() =>
                    setExpandedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      return next;
                    })
                  }
                >
                  {showChildren || expandedIds.has(p.id) ? "▾" : "▸"}
                </button>
                <Link to={`/products/${p.id}`}>{p.productCode}</Link>
              </td>
              {visibleCols.map((c) => (
                <td key={c.key} className={c.className}>
                  {c.render(p)}
                </td>
              ))}
            </tr>
            {(showChildren || expandedIds.has(p.id)) && (
              <tr className="variation-expand-row">
                <td />
                <td colSpan={colCount - 1}>
                  <table className="variation-subtable">
                    <thead>
                      <tr>
                        <th>枝番</th>
                        <th>SKU</th>
                        <th>軸</th>
                        <th>選択肢</th>
                        <th>型番</th>
                        <th>JAN</th>
                        <th>価格</th>
                        <th>在庫</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.variations.map((v) => (
                        <tr key={v.id}>
                          <td className="num">{v.variationNo}</td>
                          <td>
                            {v.skuCode}
                            {v.isRepresentative && (
                              <span className="badge" style={{ marginLeft: 4 }}>代表</span>
                            )}
                          </td>
                          <td>{v.axisName ?? "-"}</td>
                          <td>{v.optionValue ?? "-"}</td>
                          <td>{v.modelNumber ?? "-"}</td>
                          <td>{v.janCode ?? "-"}</td>
                          <td className="num">{yen(v.price)}</td>
                          <td className="num">{v.stockQty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
              </tr>
            )}
            </React.Fragment>
          ))}
          {data && data.items.length === 0 && (
            <tr>
              <td colSpan={colCount} className="muted">
                該当する商品がありません
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      {data && (
        <div className="pagination">
          <button
            disabled={page <= 1}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("page", String(page - 1));
              setParams(next);
            }}
          >
            前へ
          </button>
          <span>
            {page} / {totalPages} ページ（全 {data.total.toLocaleString()} 件）
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("page", String(page + 1));
              setParams(next);
            }}
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}
