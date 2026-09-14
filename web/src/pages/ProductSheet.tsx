import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DataGrid, renderTextEditor, type Column, type RenderEditCellProps } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import {
  api,
  CATEGORY_LABEL,
  STATUS_LABEL,
  type Maker,
  type Paged,
  type Product,
} from "../lib/api";

// グリッド行（編集値はすべて文字列で保持し、保存時に型変換）
type SheetRow = {
  id: number; // 負値は新規行
  productCode: string;
  category: string;
  status: string;
  name: string;
  modelNumber: string;
  janCode: string;
  cost: string;
  listPriceExTax: string;
  sellingPrice: string;
  totalPrice: string;
  supplier: string;
  bodyColor: string;
  sortNo: string;
  memo: string;
  makerName: string; // 表示のみ
};

const PER_PAGE = 200;

function toRow(p: Product): SheetRow {
  return {
    id: p.id,
    productCode: p.productCode,
    category: p.category,
    status: p.status,
    name: p.name ?? "",
    modelNumber: p.modelNumber ?? "",
    janCode: p.janCode ?? "",
    cost: p.cost?.toString() ?? "",
    listPriceExTax: p.listPriceExTax?.toString() ?? "",
    sellingPrice: p.sellingPrice?.toString() ?? "",
    totalPrice: p.totalPrice?.toString() ?? "",
    supplier: p.supplier ?? "",
    bodyColor: p.bodyColor ?? "",
    sortNo: (p as unknown as { sortNo: number | null }).sortNo?.toString() ?? "",
    memo: p.memo ?? "",
    makerName: p.maker?.nameJp ?? "",
  };
}

function selectEditor(options: Record<string, string>) {
  return function SelectEditor({ row, column, onRowChange, onClose }: RenderEditCellProps<SheetRow>) {
    return (
      <select
        autoFocus
        className="rdg-select-editor"
        value={row[column.key as keyof SheetRow] as string}
        onChange={(e) => onRowChange({ ...row, [column.key]: e.target.value }, true)}
        onBlur={() => onClose(true)}
      >
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    );
  };
}

export function ProductSheet() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [original, setOriginal] = useState<Map<number, SheetRow>>(new Map());
  const [total, setTotal] = useState(0);
  const [makers, setMakers] = useState<Maker[]>([]);
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [nextNewId, setNextNewId] = useState(-1);
  const [qInput, setQInput] = useState(params.get("q") ?? "");

  const page = Number(params.get("page") ?? 1);

  const load = useCallback(() => {
    const query = new URLSearchParams();
    for (const key of ["q", "category", "makerId"]) {
      const v = params.get(key);
      if (v) query.set(key, v);
    }
    query.set("page", String(page));
    query.set("perPage", String(PER_PAGE));
    query.set("sort", "productCode");
    query.set("order", "asc");
    api<Paged<Product>>(`/api/products?${query}`)
      .then((d) => {
        const rs = d.items.map(toRow);
        setRows(rs);
        setOriginal(new Map(rs.map((r) => [r.id, { ...r }])));
        setTotal(d.total);
        setDirtyIds(new Set());
        setMessage("");
      })
      .catch((e) => setError(e.message));
  }, [params, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<Maker[]>("/api/makers").then(setMakers).catch(() => {});
  }, []);

  const columns = useMemo((): Column<SheetRow>[] => {
    const text = (key: keyof SheetRow, name: string, width?: number): Column<SheetRow> => ({
      key,
      name,
      width,
      resizable: true,
      renderEditCell: renderTextEditor,
    });
    const num = (key: keyof SheetRow, name: string): Column<SheetRow> => ({
      ...text(key, name, 110),
      cellClass: "num",
    });
    return [
      {
        key: "productCode",
        name: "商品コード",
        width: 150,
        frozen: true,
        resizable: true,
        // 既存行のコードは主キー相当のため編集不可（新規行のみ入力可）
        renderEditCell: renderTextEditor,
        editable: (row) => row.id < 0,
        cellClass: (row) => (row.id < 0 ? "cell-new" : "cell-readonly"),
      },
      {
        key: "category",
        name: "種別",
        width: 140,
        renderEditCell: selectEditor(CATEGORY_LABEL),
        renderCell: ({ row }) => CATEGORY_LABEL[row.category] ?? row.category,
        editable: (row) => row.id < 0,
      },
      {
        key: "status",
        name: "状態",
        width: 110,
        renderEditCell: selectEditor(STATUS_LABEL),
        renderCell: ({ row }) => STATUS_LABEL[row.status] ?? row.status,
      },
      text("name", "商品名", 260),
      text("modelNumber", "本体型番", 140),
      text("janCode", "JAN", 130),
      num("cost", "仕入値(税抜)"),
      num("listPriceExTax", "定価(税抜)"),
      num("sellingPrice", "販売価格(税込)"),
      num("totalPrice", "合計販売価格"),
      text("supplier", "仕入先", 120),
      text("bodyColor", "本体カラー", 110),
      num("sortNo", "並び順"),
      text("memo", "メモ", 220),
      { key: "makerName", name: "メーカー", width: 140, cellClass: "cell-readonly" },
    ];
  }, []);

  function onRowsChange(newRows: SheetRow[], { indexes }: { indexes: number[] }) {
    setRows(newRows);
    setDirtyIds((prev) => {
      const next = new Set(prev);
      for (const i of indexes) {
        const row = newRows[i];
        const base = original.get(row.id);
        // 元の値に戻ったら dirty 解除
        if (base && JSON.stringify(base) === JSON.stringify(row)) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });
  }

  function addRow() {
    const id = nextNewId;
    setNextNewId(id - 1);
    const category = (params.get("category") as SheetRow["category"]) || "PENDANT_LIGHT";
    const newRow: SheetRow = {
      id,
      productCode: "",
      category,
      status: "ACTIVE",
      name: "",
      modelNumber: "",
      janCode: "",
      cost: "",
      listPriceExTax: "",
      sellingPrice: "",
      totalPrice: "",
      supplier: "",
      bodyColor: "",
      sortNo: "",
      memo: "",
      makerName: "",
    };
    setRows((rs) => [newRow, ...rs]);
    setDirtyIds((prev) => new Set(prev).add(id));
  }

  async function save() {
    const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));
    const dirtyRows = rows.filter((r) => dirtyIds.has(r.id));
    const invalidNew = dirtyRows.filter((r) => r.id < 0 && (!r.productCode.trim() || !r.name.trim()));
    if (invalidNew.length > 0) {
      setError("新規行には商品コードと商品名が必須です");
      return;
    }
    const badNum = dirtyRows.find((r) =>
      [r.cost, r.listPriceExTax, r.sellingPrice, r.totalPrice, r.sortNo].some(
        (v) => v.trim() !== "" && Number.isNaN(Number(v))
      )
    );
    if (badNum) {
      setError(`数値列に数値以外が入力されています: ${badNum.productCode || "(新規行)"}`);
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = dirtyRows.map((r) => ({
        ...(r.id >= 0 ? { id: r.id } : {}),
        ...(r.id < 0 ? { productCode: r.productCode.trim(), category: r.category } : {}),
        name: r.name,
        status: r.status,
        modelNumber: r.modelNumber || null,
        janCode: r.janCode || null,
        cost: numOrNull(r.cost),
        listPriceExTax: numOrNull(r.listPriceExTax),
        sellingPrice: numOrNull(r.sellingPrice),
        totalPrice: numOrNull(r.totalPrice),
        supplier: r.supplier || null,
        bodyColor: r.bodyColor || null,
        sortNo: numOrNull(r.sortNo),
        memo: r.memo || null,
      }));
      const result = await api<{
        ok: number;
        failed: number;
        results: Array<{ productCode?: string; ok: boolean; error?: string }>;
      }>("/api/products/bulk", { method: "POST", body: JSON.stringify(payload) });
      if (result.failed > 0) {
        const firstError = result.results.find((r) => !r.ok);
        setError(
          `${result.failed} 件失敗（${firstError?.productCode ?? ""}: ${firstError?.error ?? ""}）／ ${result.ok} 件保存`
        );
      } else {
        setMessage(`${result.ok} 件保存しました`);
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function setFilter(key: string, value: string) {
    if (dirtyIds.size > 0 && !confirm("未保存の変更があります。破棄して移動しますか？")) return;
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="sheet-page">
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>シート編集</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFilter("q", qInput);
          }}
        >
          <input
            placeholder="商品コード / 商品名 / 型番"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            style={{ width: 220 }}
          />
        </form>
        <select value={params.get("category") ?? ""} onChange={(e) => setFilter("category", e.target.value)}>
          <option value="">全種別</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={params.get("makerId") ?? ""} onChange={(e) => setFilter("makerId", e.target.value)}>
          <option value="">全メーカー</option>
          {makers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nameJp}
            </option>
          ))}
        </select>
        <button onClick={addRow}>＋ 行追加</button>
        <button className="primary" onClick={save} disabled={saving || dirtyIds.size === 0}>
          {saving ? "保存中…" : `保存（${dirtyIds.size} 行）`}
        </button>
        <span style={{ marginLeft: "auto" }}>
          <Link to="/products">一覧表示へ</Link>
        </span>
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div style={{ color: "#166534", padding: "4px 0" }}>{message}</div>}

      <DataGrid
        className="rdg-light product-sheet-grid"
        columns={columns}
        rows={rows}
        onRowsChange={onRowsChange}
        rowKeyGetter={(r) => r.id}
        rowClass={(r) => (dirtyIds.has(r.id) ? "row-dirty" : undefined)}
        defaultColumnOptions={{ sortable: false }}
      />

      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setFilter("page", String(page - 1))}>
          前へ
        </button>
        <span>
          {page} / {totalPages} ページ（全 {total.toLocaleString()} 件・{PER_PAGE}件/ページ）
        </span>
        <button disabled={page >= totalPages} onClick={() => setFilter("page", String(page + 1))}>
          次へ
        </button>
        <span className="muted">
          セルをダブルクリック（またはEnter）で編集。矢印キーで移動。新規行は商品コード・種別も入力可。
        </span>
      </div>
    </div>
  );
}
