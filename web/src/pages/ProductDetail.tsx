import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  api,
  CATEGORY_LABEL,
  DIFF_LABEL,
  KIND_LABEL,
  Product,
  STATUS_LABEL,
  Variation,
  yen,
} from "../lib/api";
import { Modal } from "../components/filters";

const IMAGE_TYPE_OPTIONS: Array<[string, string]> = [
  ["MAIN", "メイン画像"],
  ["IMAGE", "イメージ画像"],
  ["SIZE", "サイズ画像"],
  ["FUNCTION", "機能画像"],
  ["REMOTE", "リモコン画像"],
  ["ACCESSORY", "付属品画像"],
  ["LIST", "一覧画像"],
  ["BANNER", "バナー"],
  ["AD", "広告画像"],
];

// 拡張属性の表示ラベル
const LIGHTING_LABELS: Record<string, string> = {
  bulbType: "電球タブ",
  bulbKind: "電球種類",
  initialBulbType: "初期電球",
  bulbColor: "電球色",
  bulbBase: "口金",
  mainBulbCount: "メイン電球数",
  bulbReplacement: "電球交換",
  brightnessLm: "明るさ(lm)",
  colorTempLow: "色温度1(K)",
  colorTempHigh: "色温度2(K)",
  raValue: "Ra",
  wattEquivalent: "W相当",
  dimmingMethod: "調光方法",
  installationType: "取付タイプ",
  inclinedCeiling: "傾斜対応",
  cordStorage: "コード収納",
  tatami: "畳数",
  material: "素材",
};

const FAN_LABELS: Record<string, string> = {
  motorType: "AC/DC",
  bladeCount: "羽枚数",
  windSpeed: "風速(m/s)",
  windVolume: "風量(m3/min)",
  rotationSpeed: "回転数(r/min)",
  windLevels: "風量レベル",
  powerConsumptionW: "消費電力(W)",
  extensionPipe: "延長パイプ",
  mountType: "取付",
  heightToBladeMm: "羽根まで高さ(mm)",
  lightCount: "照明数",
  lightKind: "照明種類",
  lightColor: "光色",
  bladeColor1: "羽の色①",
  bladeColor2: "羽の色②",
  batteryType: "電池",
  brightnessLm: "照度(lm)",
  tatamiFrom: "畳数(から)",
  tatamiTo: "畳数(まで)",
  angledCeiling: "斜め取付",
  fanGrade: "グレード",
};

function AttrsTable({ attrs, labels }: { attrs: Record<string, unknown>; labels: Record<string, string> }) {
  const rows = Object.entries(labels)
    .map(([key, label]) => ({ label, value: attrs[key] }))
    .filter((r) => r.value !== null && r.value !== undefined && r.value !== "" && r.value !== false);
  if (rows.length === 0) return <div className="muted">データなし</div>;
  return (
    <table>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td style={{ width: 180 }} className="muted">
              {r.label}
            </td>
            <td>{String(r.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<string[]>([]);

  // バリエーション（子SKU）の追加・編集モーダル
  type VariationForm = {
    id: number | null;
    variationNo: number;
    axisName: string;
    optionValue: string;
    modelNumber: string;
    janCode: string;
    price: string;
    stockQty: string;
    isRepresentative: boolean;
  };
  const [variationModal, setVariationModal] = useState<VariationForm | null>(null);

  // 画像アップロード
  const [imageType, setImageType] = useState("MAIN");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api<Array<{ value: string }>>("/api/masters?type=supplier&activeOnly=1")
      .then((items) => setSuppliers(items.map((i) => i.value)))
      .catch(() => {});
  }, []);

  function openAddVariation() {
    if (!product) return;
    const nextNo = Math.max(0, ...product.variations.map((v) => v.variationNo)) + 1;
    setVariationModal({
      id: null,
      variationNo: nextNo,
      axisName: product.variations[0]?.axisName ?? "",
      optionValue: "",
      modelNumber: "",
      janCode: "",
      price: "",
      stockQty: "0",
      isRepresentative: false,
    });
  }

  function openEditVariation(v: Variation) {
    setVariationModal({
      id: v.id,
      variationNo: v.variationNo,
      axisName: v.axisName ?? "",
      optionValue: v.optionValue ?? "",
      modelNumber: v.modelNumber ?? "",
      janCode: v.janCode ?? "",
      price: v.price?.toString() ?? "",
      stockQty: String(v.stockQty),
      isRepresentative: v.isRepresentative,
    });
  }

  async function saveVariation(e: React.FormEvent) {
    e.preventDefault();
    if (!variationModal) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        variationNo: variationModal.variationNo,
        axisName: variationModal.axisName || null,
        optionValue: variationModal.optionValue || null,
        modelNumber: variationModal.modelNumber || null,
        janCode: variationModal.janCode || null,
        price: variationModal.price === "" ? null : Number(variationModal.price),
        stockQty: Number(variationModal.stockQty) || 0,
        isRepresentative: variationModal.isRepresentative,
      };
      if (variationModal.id) {
        await api(`/api/products/${id}/variations/${variationModal.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await api(`/api/products/${id}/variations`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setVariationModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeVariation(v: { id: number; skuCode: string }) {
    if (!confirm(`バリエーション ${v.skuCode} を削除しますか？`)) return;
    setError("");
    try {
      await api(`/api/products/${id}/variations/${v.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function uploadImage(e: React.FormEvent) {
    e.preventDefault();
    if (!imageFile) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", imageFile);
      form.append("imageType", imageType);
      const res = await fetch(`/api/products/${id}/images`, {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setImageFile(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function removeImage(imageId: number, fileName: string) {
    if (!confirm(`画像「${fileName}」を削除しますか？`)) return;
    setError("");
    try {
      await api(`/api/products/${id}/images/${imageId}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const load = useCallback(() => {
    api<Product>(`/api/products/${id}`)
      .then(setProduct)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit() {
    if (!product) return;
    setForm({
      name: product.name ?? "",
      status: product.status,
      modelNumber: product.modelNumber ?? "",
      janCode: product.janCode ?? "",
      cost: product.cost?.toString() ?? "",
      listPriceExTax: product.listPriceExTax?.toString() ?? "",
      sellingPrice: product.sellingPrice?.toString() ?? "",
      totalPrice: product.totalPrice?.toString() ?? "",
      supplier: product.supplier ?? "",
      comment: product.comment ?? "",
      memo: product.memo ?? "",
    });
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const numOrNull = (v: string) => (v === "" ? null : Number(v));
      await api(`/api/products/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.name,
          status: form.status,
          modelNumber: form.modelNumber || null,
          janCode: form.janCode || null,
          cost: numOrNull(form.cost),
          listPriceExTax: numOrNull(form.listPriceExTax),
          sellingPrice: numOrNull(form.sellingPrice),
          totalPrice: numOrNull(form.totalPrice),
          supplier: form.supplier || null,
          comment: form.comment || null,
          memo: form.memo || null,
        }),
      });
      setEditing(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function updateStock(variationId: number, stockQty: number) {
    try {
      await api(`/api/products/${id}/variations/${variationId}/stock`, {
        method: "PATCH",
        body: JSON.stringify({ stockQty }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove() {
    if (!confirm("この商品を削除（非表示）にしますか？")) return;
    await api(`/api/products/${id}`, { method: "DELETE" });
    navigate("/products");
  }

  if (error && !product) return <div className="error">{error}</div>;
  if (!product) return <div className="muted">読み込み中…</div>;

  return (
    <div>
      <div className="toolbar">
        <Link to="/products">← 商品一覧</Link>
        <h2 style={{ margin: 0 }}>
          {product.productCode}
          <span className="muted" style={{ fontSize: 14, marginLeft: 12 }}>
            {CATEGORY_LABEL[product.category]} / {KIND_LABEL[product.productKind]}
          </span>
        </h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {editing ? (
            <>
              <button onClick={() => setEditing(false)}>キャンセル</button>
              <button className="primary" onClick={save} disabled={saving}>
                {saving ? "保存中…" : "保存"}
              </button>
            </>
          ) : (
            <>
              <button onClick={startEdit}>編集</button>
              <button className="danger" onClick={remove}>
                削除
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="panel">
        {editing ? (
          <div>
            <div className="form-grid">
              <div>
                <label>商品名</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label>ステータス</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>本体型番</label>
                <input value={form.modelNumber} onChange={(e) => setForm({ ...form, modelNumber: e.target.value })} />
              </div>
              <div>
                <label>JANコード</label>
                <input value={form.janCode} onChange={(e) => setForm({ ...form, janCode: e.target.value })} />
              </div>
              <div>
                <label>仕入値(税抜)</label>
                <input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
              </div>
              <div>
                <label>定価(税抜)</label>
                <input
                  type="number"
                  value={form.listPriceExTax}
                  onChange={(e) => setForm({ ...form, listPriceExTax: e.target.value })}
                />
              </div>
              <div>
                <label>販売価格(税込)</label>
                <input
                  type="number"
                  value={form.sellingPrice}
                  onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                />
              </div>
              <div>
                <label>合計販売価格(税込)</label>
                <input
                  type="number"
                  value={form.totalPrice}
                  onChange={(e) => setForm({ ...form, totalPrice: e.target.value })}
                />
              </div>
              <div>
                <label>仕入先</label>
                <input
                  list="supplier-master"
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                />
                <datalist id="supplier-master">
                  {suppliers.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>商品コメント</label>
              <textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
            </div>
            <div className="field">
              <label>メモ</label>
              <textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
            </div>
          </div>
        ) : (
          <table>
            <tbody>
              <tr>
                <td className="muted" style={{ width: 160 }}>商品名</td>
                <td>{product.name}</td>
                <td className="muted" style={{ width: 160 }}>ステータス</td>
                <td>{STATUS_LABEL[product.status] ?? product.status}</td>
              </tr>
              <tr>
                <td className="muted">メーカー</td>
                <td>{product.maker ? `${product.maker.nameJp}（${product.maker.makerCode}）` : "-"}</td>
                <td className="muted">本体型番</td>
                <td>{product.modelNumber ?? "-"}</td>
              </tr>
              <tr>
                <td className="muted">JAN</td>
                <td>{product.janCode ?? "-"}</td>
                <td className="muted">仕入先</td>
                <td>{product.supplier ?? "-"}</td>
              </tr>
              <tr>
                <td className="muted">仕入値(税抜)</td>
                <td>{yen(product.cost)}</td>
                <td className="muted">定価(税抜)</td>
                <td>{yen(product.listPriceExTax)}</td>
              </tr>
              <tr>
                <td className="muted">販売価格(税込)</td>
                <td>{yen(product.sellingPrice)}</td>
                <td className="muted">合計販売価格</td>
                <td>{yen(product.totalPrice)}</td>
              </tr>
              <tr>
                <td className="muted">寸法</td>
                <td>
                  {[
                    product.widthMm && `幅${product.widthMm}`,
                    product.depthMm && `奥行${product.depthMm}`,
                    product.heightMm && `高さ${product.heightMm}`,
                  ]
                    .filter(Boolean)
                    .join(" × ") || "-"}
                  {product.weightKg ? ` / ${product.weightKg}kg` : ""}
                </td>
                <td className="muted">本体カラー</td>
                <td>{product.bodyColor ?? "-"}</td>
              </tr>
              {product.statusNote && (
                <tr>
                  <td className="muted">状態メモ</td>
                  <td colSpan={3}>{product.statusNote}</td>
                </tr>
              )}
              {product.comment && (
                <tr>
                  <td className="muted">コメント</td>
                  <td colSpan={3} style={{ whiteSpace: "pre-wrap" }}>{product.comment}</td>
                </tr>
              )}
              {product.memo && (
                <tr>
                  <td className="muted">メモ</td>
                  <td colSpan={3} style={{ whiteSpace: "pre-wrap" }}>{product.memo}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="toolbar" style={{ marginTop: 24, marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>
          バリエーション（子SKU {product.variations.length} 件 / 親: {product.productCode}）
        </h3>
        <button onClick={openAddVariation}>＋ バリエーション追加</button>
      </div>
      <table>
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
            <th style={{ width: 130 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {product.variations.map((v) => (
            <tr key={v.id}>
              <td className="num">{v.variationNo}</td>
              <td>
                {v.skuCode}
                {v.isRepresentative && <span className="badge" style={{ marginLeft: 6 }}>代表</span>}
              </td>
              <td>{v.axisName ?? "-"}</td>
              <td>{v.optionValue ?? "-"}</td>
              <td>{v.modelNumber ?? "-"}</td>
              <td>{v.janCode ?? "-"}</td>
              <td className="num">{yen(v.price)}</td>
              <td style={{ width: 110 }}>
                <input
                  type="number"
                  min={0}
                  defaultValue={v.stockQty}
                  style={{ width: 80 }}
                  onBlur={(e) => {
                    const qty = Number(e.target.value);
                    if (qty !== v.stockQty) updateStock(v.id, qty);
                  }}
                />
              </td>
              <td style={{ display: "flex", gap: 6 }}>
                <button onClick={() => openEditVariation(v)}>編集</button>
                <button
                  className="danger"
                  disabled={product.variations.length <= 1}
                  title={product.variations.length <= 1 ? "最後の1件は削除できません" : ""}
                  onClick={() => removeVariation(v)}
                >
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {variationModal && (
        <Modal
          title={
            variationModal.id
              ? `バリエーション編集（${product.productCode}v${variationModal.variationNo}）`
              : `バリエーション追加（枝番 ${variationModal.variationNo}）`
          }
          onClose={() => setVariationModal(null)}
        >
          <form onSubmit={saveVariation}>
            <div className="form-grid">
              <div>
                <label>軸名（例: 電球 / 光色）</label>
                <input
                  value={variationModal.axisName}
                  onChange={(e) => setVariationModal({ ...variationModal, axisName: e.target.value })}
                />
              </div>
              <div>
                <label>選択肢（例: 電球色）</label>
                <input
                  value={variationModal.optionValue}
                  onChange={(e) => setVariationModal({ ...variationModal, optionValue: e.target.value })}
                />
              </div>
              <div>
                <label>型番</label>
                <input
                  value={variationModal.modelNumber}
                  onChange={(e) => setVariationModal({ ...variationModal, modelNumber: e.target.value })}
                />
              </div>
              <div>
                <label>JANコード</label>
                <input
                  value={variationModal.janCode}
                  onChange={(e) => setVariationModal({ ...variationModal, janCode: e.target.value })}
                />
              </div>
              <div>
                <label>価格（税込）</label>
                <input
                  type="number"
                  value={variationModal.price}
                  onChange={(e) => setVariationModal({ ...variationModal, price: e.target.value })}
                />
              </div>
              <div>
                <label>在庫数</label>
                <input
                  type="number"
                  min={0}
                  value={variationModal.stockQty}
                  onChange={(e) => setVariationModal({ ...variationModal, stockQty: e.target.value })}
                />
              </div>
            </div>
            <label className="checkbox-filter" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={variationModal.isRepresentative}
                onChange={(e) =>
                  setVariationModal({ ...variationModal, isRepresentative: e.target.checked })
                }
              />
              代表バリエーション
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setVariationModal(null)}>
                キャンセル
              </button>
              <button type="submit" className="primary" disabled={saving}>
                {saving ? "保存中…" : variationModal.id ? "保存" : "追加する"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {product.setComponents && product.setComponents.length > 0 && (
        <>
          <h3>セット構成</h3>
          <table>
            <thead>
              <tr>
                <th>役割</th>
                <th>型番</th>
                <th>引当先商品</th>
                <th>数量</th>
              </tr>
            </thead>
            <tbody>
              {product.setComponents.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="badge gray">{c.role}</span>
                  </td>
                  <td>{c.componentModel}</td>
                  <td>
                    {c.componentProduct ? (
                      <Link to={`/products/${c.componentProduct.id}`}>
                        {c.componentProduct.productCode} {c.componentProduct.name}
                      </Link>
                    ) : (
                      <span className="muted">未引当</span>
                    )}
                  </td>
                  <td className="num">{c.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {product.lightingAttrs && (
        <>
          <h3>照明属性</h3>
          <AttrsTable attrs={product.lightingAttrs} labels={LIGHTING_LABELS} />
        </>
      )}

      {product.fanAttrs && (
        <>
          <h3>ファン属性</h3>
          <AttrsTable attrs={product.fanAttrs} labels={FAN_LABELS} />
        </>
      )}

      <h3>画像（{product.images.length}）</h3>
      <div className="panel">
        <form onSubmit={uploadImage} className="toolbar" style={{ marginBottom: 0 }}>
          <select value={imageType} onChange={(e) => setImageType(e.target.value)}>
            {IMAGE_TYPE_OPTIONS.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          />
          <button type="submit" className="primary" disabled={!imageFile || uploading}>
            {uploading ? "アップロード中…" : "アップロード"}
          </button>
        </form>
      </div>
      {product.images.length === 0 ? (
        <div className="muted">画像なし</div>
      ) : (
        <div className="image-grid">
          {product.images.map((img) => (
            <div key={img.id} className="image-card">
              {img.url ? (
                <a href={img.url} target="_blank" rel="noreferrer">
                  <img src={img.url} alt={img.fileName} loading="lazy" />
                </a>
              ) : (
                <div className="image-placeholder" title="現行システムの画像（ファイル名のみ）">
                  未アップロード
                </div>
              )}
              <div className="image-meta">
                <span className="badge gray">
                  {img.imageType}
                  {img.sortNo}
                </span>
                <button className="danger" onClick={() => removeImage(img.id, img.fileName)}>
                  削除
                </button>
              </div>
              <div className="image-name" title={img.fileName}>
                {img.fileName}
              </div>
            </div>
          ))}
        </div>
      )}

      {product.channelLinks && product.channelLinks.length > 0 && (
        <>
          <h3>連携状態</h3>
          <table>
            <thead>
              <tr>
                <th>連携先</th>
                <th>差分</th>
                <th>登録状態</th>
                <th>最終送信</th>
              </tr>
            </thead>
            <tbody>
              {product.channelLinks.map((l) => (
                <tr key={l.id}>
                  <td>{l.channel.name}</td>
                  <td>{DIFF_LABEL[l.diffStatus] ?? l.diffStatus}</td>
                  <td>{l.linkStatus}</td>
                  <td>{l.lastSentAt ? new Date(l.lastSentAt).toLocaleString("ja-JP") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
