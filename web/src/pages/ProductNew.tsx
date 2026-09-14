import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, CATEGORY_LABEL, KIND_LABEL, Maker, STATUS_LABEL } from "../lib/api";

// フィールド定義（type: text/number/date/checkbox/textarea、master: 入力候補のマスタ種別）
type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "checkbox" | "textarea";
  master?: string;
  placeholder?: string;
};

const PRODUCT_SECTIONS: Array<{ title: string; fields: Field[] }> = [
  {
    title: "基本情報",
    fields: [
      { key: "seriesCode", label: "シリーズコード" },
      { key: "genreCode", label: "ジャンルコード" },
      { key: "seqNo", label: "通番", type: "number" },
      { key: "summary", label: "商品概要" },
      { key: "modelNumber", label: "本体型番" },
      { key: "combinationModel", label: "組み合わせ型番" },
      { key: "janCode", label: "JANコード" },
      { key: "statusNote", label: "状態メモ（入荷待ち文言等）" },
      { key: "successorModel", label: "後継機種" },
      { key: "releaseDate", label: "発売日", type: "date" },
    ],
  },
  {
    title: "価格",
    fields: [
      { key: "cost", label: "仕入値(税抜)", type: "number" },
      { key: "costInTax", label: "仕入値(税込)", type: "number" },
      { key: "listPriceExTax", label: "定価(税抜)", type: "number" },
      { key: "listPriceInTax", label: "定価(税込)", type: "number" },
      { key: "isOpenPrice", label: "オープン価格", type: "checkbox" },
      { key: "sellingPriceExTax", label: "販売価格(税抜)", type: "number" },
      { key: "sellingPrice", label: "販売価格(税込)", type: "number" },
      { key: "totalPrice", label: "合計販売価格(税込)", type: "number" },
      { key: "priceControlled", label: "価格統制", type: "checkbox" },
      { key: "pointRate", label: "ポイント", type: "number" },
      { key: "supplier", label: "仕入先", master: "supplier" },
      { key: "shippingEstimate", label: "送料目安", type: "number" },
    ],
  },
  {
    title: "寸法・共通",
    fields: [
      { key: "widthMm", label: "幅(mm)", type: "number" },
      { key: "depthMm", label: "奥行(mm)", type: "number" },
      { key: "heightMm", label: "高さ(mm)", type: "number" },
      { key: "height2Mm", label: "高さ2(mm)", type: "number" },
      { key: "totalHeightMinMm", label: "全高最低(mm)", type: "number" },
      { key: "totalHeightMaxMm", label: "全高最高(mm)", type: "number" },
      { key: "weightKg", label: "重量(kg)", type: "number" },
      { key: "warranty", label: "保証期間", master: "warranty" },
      { key: "moneyBackDays", label: "返金保証(日)", type: "number" },
      { key: "countryOfOrigin", label: "生産国" },
      { key: "goodDesignYear", label: "GoodDesign受賞年", type: "number" },
      { key: "bodyColor", label: "本体カラー", master: "body_color" },
    ],
  },
  {
    title: "文章",
    fields: [
      { key: "comment", label: "商品コメント（メイン紹介文）", type: "textarea" },
      { key: "detail", label: "機能詳細（サブ紹介文）", type: "textarea" },
    ],
  },
  {
    title: "運用",
    fields: [
      { key: "isNew", label: "新着", type: "checkbox" },
      { key: "isRecommended", label: "おすすめ", type: "checkbox" },
      { key: "isSameDayShipping", label: "即日発送", type: "checkbox" },
      { key: "sortNo", label: "並び順番号", type: "number" },
      { key: "shippingLeadTime", label: "通常出荷納期" },
      { key: "fsShippingPattern", label: "FS送料パターン" },
      { key: "relatedProducts", label: "関連商品" },
      { key: "exampleUrl", label: "事例写真URL" },
      { key: "memo", label: "メモ", type: "textarea" },
    ],
  },
];

const LIGHTING_FIELDS: Field[] = [
  { key: "installationCode", label: "取付方法コード(E/W/D/B)" },
  { key: "installationType", label: "取付タイプ", master: "installation_type" },
  { key: "bulbType", label: "電球タブ（非調光/調光…）" },
  { key: "bulbKind", label: "電球種類（LED/白熱球）" },
  { key: "initialBulbType", label: "初期電球種類" },
  { key: "bulbColor", label: "電球色", master: "bulb_color" },
  { key: "bulbBase", label: "口金", master: "bulb_base" },
  { key: "mainBulbCount", label: "メイン電球数", type: "number" },
  { key: "subBulb", label: "サブ電球" },
  { key: "bulbReplacement", label: "電球交換（同梱/一体型/無し）" },
  { key: "bundledBulbModel", label: "組み合わせ電球型番" },
  { key: "brightnessLm", label: "明るさ(lm)" },
  { key: "colorTempLow", label: "色温度1(K)", type: "number" },
  { key: "colorTempHigh", label: "色温度2(K)", type: "number" },
  { key: "raValue", label: "Ra値", type: "number" },
  { key: "wattEquivalent", label: "W相当" },
  { key: "wattEquivalentTable", label: "テーブルサイズ別W相当" },
  { key: "dimmingMethod", label: "調光方法" },
  { key: "stepSwitching", label: "段階切替", type: "checkbox" },
  { key: "pullSwitch", label: "プルスイッチ式", type: "checkbox" },
  { key: "remoteIncluded", label: "リモコン付属", type: "checkbox" },
  { key: "inclinedCeiling", label: "傾斜対応(n度)" },
  { key: "highCeiling", label: "高所天井向け", type: "checkbox" },
  { key: "cordStorage", label: "コード収納" },
  { key: "attachableCount", label: "取付可能数", type: "number" },
  { key: "tatami", label: "畳数" },
  { key: "roomWholeLighting", label: "部屋全体照明", type: "checkbox" },
  { key: "material", label: "素材", master: "material" },
];

const FAN_FIELDS: Field[] = [
  { key: "motorType", label: "モーター(AC/DC)", master: "motor_type" },
  { key: "bladeCount", label: "羽根枚数", type: "number" },
  { key: "windSpeed", label: "風速(m/sec)", type: "number" },
  { key: "windVolume", label: "風量(m3/min)", type: "number" },
  { key: "rotationSpeed", label: "回転数(r/min)", type: "number" },
  { key: "windLevels", label: "風量レベル", type: "number" },
  { key: "powerConsumptionW", label: "消費電力W(モーター)", type: "number" },
  { key: "extensionPipe", label: "延長パイプ" },
  { key: "pipeVariation", label: "パイプバリエーション" },
  { key: "mountType", label: "取付（直付/パイプ）" },
  { key: "heightToBladeMm", label: "羽根までの高さ(mm)", type: "number" },
  { key: "lightCount", label: "照明の数", type: "number" },
  { key: "lightKind", label: "照明の種類" },
  { key: "lightColor", label: "光色", master: "light_color" },
  { key: "bladeColor1", label: "羽の色①" },
  { key: "bladeColor2", label: "羽の色②" },
  { key: "colorCategory", label: "カラー種別" },
  { key: "rhythmMode", label: "リズム回転", type: "checkbox" },
  { key: "dimming", label: "調光（有無NG）" },
  { key: "remoteIncluded", label: "リモコン有無", type: "checkbox" },
  { key: "batteryType", label: "電池の種類" },
  { key: "batteryCount", label: "付属電池数", type: "number" },
  { key: "brightnessLm", label: "照度(lm)", type: "number" },
  { key: "wattEquivalent", label: "明るさW相当" },
  { key: "tatamiFrom", label: "畳数(から)", type: "number" },
  { key: "tatamiTo", label: "畳数(まで)", type: "number" },
  { key: "angledCeiling", label: "斜め取り付け可否" },
  { key: "fanGrade", label: "グレード" },
];

type FormState = Record<string, string | boolean>;

function initState(fields: Field[]): FormState {
  return Object.fromEntries(fields.map((f) => [f.key, f.type === "checkbox" ? false : ""]));
}

// フォーム値 → API送信値（数値変換・空はnull）
function toPayload(fields: Field[], state: FormState): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = state[f.key];
    if (f.type === "checkbox") {
      out[f.key] = v === true;
    } else if (f.type === "number") {
      out[f.key] = v === "" ? null : Number(v);
    } else if (f.type === "date") {
      out[f.key] = v === "" ? null : new Date(`${v}T00:00:00+09:00`).toISOString();
    } else {
      out[f.key] = v === "" ? null : v;
    }
  }
  return out;
}

export function ProductNew() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [makers, setMakers] = useState<Maker[]>([]);
  const [masterValues, setMasterValues] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [head, setHead] = useState({
    productCode: "",
    category: params.get("category") ?? "PENDANT_LIGHT",
    productKind: "SINGLE",
    name: "",
    makerId: "",
    status: "ACTIVE",
  });
  const allProductFields = useMemo(() => PRODUCT_SECTIONS.flatMap((s) => s.fields), []);
  const [form, setForm] = useState<FormState>(() => initState(allProductFields));
  const [lighting, setLighting] = useState<FormState>(() => initState(LIGHTING_FIELDS));
  const [fan, setFan] = useState<FormState>(() => initState(FAN_FIELDS));

  const isLighting = head.category === "PENDANT_LIGHT" || head.category === "CEILING_LIGHT";
  const isFan = head.category === "CEILING_FAN";

  useEffect(() => {
    api<Maker[]>("/api/makers").then(setMakers).catch(() => {});
    api<Array<{ type: string; value: string; active: boolean }>>("/api/masters?activeOnly=1")
      .then((items) => {
        const grouped: Record<string, string[]> = {};
        for (const i of items) (grouped[i.type] ??= []).push(i.value);
        setMasterValues(grouped);
      })
      .catch(() => {});
  }, []);

  function renderField(
    f: Field,
    state: FormState,
    setState: React.Dispatch<React.SetStateAction<FormState>>
  ) {
    const set = (v: string | boolean) => setState((s) => ({ ...s, [f.key]: v }));
    if (f.type === "checkbox") {
      return (
        <label key={f.key} className="checkbox-filter" style={{ alignSelf: "end", paddingBottom: 8 }}>
          <input
            type="checkbox"
            checked={state[f.key] === true}
            onChange={(e) => set(e.target.checked)}
          />
          {f.label}
        </label>
      );
    }
    if (f.type === "textarea") {
      return (
        <div key={f.key} style={{ gridColumn: "1 / -1" }}>
          <label>{f.label}</label>
          <textarea
            value={(state[f.key] as string) ?? ""}
            onChange={(e) => set(e.target.value)}
            style={{ width: "100%", minHeight: 70 }}
          />
        </div>
      );
    }
    const listId = f.master ? `master-${f.master}` : undefined;
    return (
      <div key={f.key}>
        <label>{f.label}</label>
        <input
          type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
          list={listId}
          value={(state[f.key] as string) ?? ""}
          placeholder={f.placeholder}
          onChange={(e) => set(e.target.value)}
        />
        {listId && (
          <datalist id={listId}>
            {(masterValues[f.master!] ?? []).map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        )}
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        productCode: head.productCode,
        category: head.category,
        productKind: head.productKind,
        name: head.name,
        makerId: head.makerId ? Number(head.makerId) : null,
        status: head.status,
        ...toPayload(allProductFields, form),
      };
      if (isLighting) payload.lightingAttrs = toPayload(LIGHTING_FIELDS, lighting);
      if (isFan) payload.fanAttrs = toPayload(FAN_FIELDS, fan);
      const created = await api<{ id: number }>("/api/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      navigate(`/products/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      window.scrollTo({ top: 0 });
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    navigate(-1);
  }

  return (
    <div>
      <h2>商品登録</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={submit}>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>商品識別 *</h3>
          <div className="form-grid">
            <div>
              <label>商品コード *</label>
              <input
                required
                value={head.productCode}
                onChange={(e) => setHead({ ...head, productCode: e.target.value })}
                placeholder="例: IAE001 / OD-0010E-CL"
              />
            </div>
            <div>
              <label>商品種別 *</label>
              <select
                value={head.category}
                onChange={(e) => setHead({ ...head, category: e.target.value })}
              >
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>商品区分 *</label>
              <select
                value={head.productKind}
                onChange={(e) => setHead({ ...head, productKind: e.target.value })}
              >
                {Object.entries(KIND_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>メーカー</label>
              <select
                value={head.makerId}
                onChange={(e) => setHead({ ...head, makerId: e.target.value })}
              >
                <option value="">未選択</option>
                {makers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nameJp}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label>商品名 *</label>
              <input
                required
                value={head.name}
                onChange={(e) => setHead({ ...head, name: e.target.value })}
              />
            </div>
            <div>
              <label>ステータス</label>
              <select
                value={head.status}
                onChange={(e) => setHead({ ...head, status: e.target.value })}
              >
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {PRODUCT_SECTIONS.map((section) => (
          <div className="panel" key={section.title}>
            <h3 style={{ marginTop: 0 }}>{section.title}</h3>
            <div className="form-grid">
              {section.fields.map((f) => renderField(f, form, setForm))}
            </div>
          </div>
        ))}

        {isLighting && (
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>照明属性</h3>
            <div className="form-grid">
              {LIGHTING_FIELDS.map((f) => renderField(f, lighting, setLighting))}
            </div>
          </div>
        )}

        {isFan && (
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>ファン属性</h3>
            <div className="form-grid">{FAN_FIELDS.map((f) => renderField(f, fan, setFan))}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "登録中…" : "登録する"}
          </button>
          <button type="button" onClick={cancel}>
            キャンセル
          </button>
          <span className="muted">登録時に代表SKU（v1）が自動作成されます</span>
        </div>
      </form>
    </div>
  );
}
