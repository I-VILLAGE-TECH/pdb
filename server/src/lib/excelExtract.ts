// 現行2ブック（ペンダントライト一覧.xlsm / シーリングファン一覧.xlsb）の解析
// tools/import/extract.py と同じマッピングの TypeScript 移植（Web画面からのインポート用）
import * as XLSX from "xlsx";

// ---------- 抽出結果の型（import側と共有） ----------

export type MakerJson = {
  makerCode: string;
  nameJp: string;
  nameEn?: string | null;
  imgFolder?: string | null;
};

export type ProductJson = Record<string, unknown> & {
  productCode: string;
  category: string;
  productKind: string;
  makerCode?: string | null;
  name: string;
  lightingAttrs?: Record<string, unknown> | null;
  fanAttrs?: Record<string, unknown> | null;
  images?: Array<Record<string, unknown>>;
  variations?: Array<Record<string, unknown>>;
  setComponents?: Array<Record<string, unknown>>;
  channelPrices?: Array<{ channelCode: string; price: number }>;
};

export type ExtractResult = {
  bookType: "PL" | "CF";
  products: ProductJson[];
  makers: MakerJson[];
};

// ---------- ユーティリティ（extract.py と同等） ----------

type Cell = string | number | boolean | Date | null | undefined;
type Row = Cell[];

function s(v: Cell): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const text = String(v).trim();
  return text || null;
}

function rawS(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v);
  return t.trim() ? t : null;
}
function numInt(v: Cell): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function numFloat(v: Cell): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function flag(v: Cell): boolean {
  const t = s(v);
  return t === "○" || t === "◎" || t === "Y" || t === "y" || t === "True" || t === "TRUE" || t === "あり";
}

function isoDate(v: Cell): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const m = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(String(v));
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}T00:00:00.000Z`;
  }
  return null;
}

function sheetRows(wb: XLSX.WorkBook, name: string): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`シート「${name}」が見つかりません`);
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, raw: true, defval: null });
}

// ---------- ペンダントライト（.xlsm） ----------

const PL_SHEET = "ペンダントライト一覧";

const PL_IMAGE_COLS: Array<[number, string, number]> = [
  [99, "MAIN", 2],
  [101, "IMAGE", 15],
  [116, "SIZE", 3],
  [119, "FUNCTION", 6],
];

function plStatus(row: Row): string {
  if (s(row[145])) return "HIDDEN"; // データ削除
  const end = s(row[4]); // 販売終了 ○終了 / △終了在庫有
  if (end === "○") return "DISCONTINUED";
  if (end === "△") return "DISCONTINUED_IN_STOCK";
  if (s(row[3])) return "BACKORDER"; // 入荷待ち
  return "ACTIVE";
}

export function extractPl(wb: XLSX.WorkBook): ExtractResult {
  const rows = sheetRows(wb, PL_SHEET);
  const makers = new Map<string, MakerJson>();
  const groups = new Map<string, { parent: Row | null; children: Row[] }>();

  // データ行の直後にID(メーカー記号+通番)だけ数式で埋まったテンプレート行が続く箇所がある。
  // 現行VBAの関連商品(独自コメント(8))はこの行も範囲判定に含むため、直前の商品にそのID値を記録して再現する
  const templateFollows = new Map<string, string>();
  let lastParentCode: string | null = null;
  for (let ri = 3; ri < rows.length; ri++) {
    const row: Row = [...(rows[ri] ?? [])];
    row.length = Math.max(row.length, 170);
    const sku = s(row[18]); // fazoo管理型番(ユニーク)
    const parentCode = s(row[16]); // fazoo管理型番 親
    if (!sku || !parentCode) {
      if (s(row[7]) && s(row[9]) && lastParentCode && !templateFollows.has(lastParentCode)) {
        templateFollows.set(lastParentCode, `${s(row[7])}${s(row[9])}`);
      }
      continue;
    }
    lastParentCode = parentCode;
    const makerCode = s(row[7]);
    if (makerCode && !makers.has(makerCode)) {
      makers.set(makerCode, {
        makerCode,
        nameJp: s(row[20]) ?? makerCode,
        nameEn: s(row[21]),
        imgFolder: s(row[131]),
      });
    }
    let g = groups.get(parentCode);
    if (!g) {
      g = { parent: null, children: [] };
      groups.set(parentCode, g);
    }
    const kind = s(row[15]); // 単品 / 親バリエーション / 子バリエーション
    if ((kind === "単品" || kind === "親バリエーション") && g.parent === null) {
      g.parent = row;
    } else {
      g.children.push(row);
    }
  }

  const products: ProductJson[] = [];
  for (const [parentCode, g] of groups) {
    const p = g.parent ?? g.children[0];
    if (!p) continue;
    const kind = s(p[15]);
    const allRows = [p, ...g.children];

    const categoryMap: Record<string, string> = {
      PL: "PENDANT_LIGHT",
      CL: "CEILING_LIGHT",
      CF: "CEILING_FAN",
    };
    const category = categoryMap[s(p[6]) ?? "PL"] ?? "OTHER";

    const images: Array<Record<string, unknown>> = [];
    for (const [start, imageType, count] of PL_IMAGE_COLS) {
      for (let i = 0; i < count; i++) {
        const fn = s(p[start + i]);
        if (fn) images.push({ imageType, sortNo: i + 1, fileName: fn });
      }
    }
    if (s(p[125])) {
      images.push({
        imageType: "BANNER",
        sortNo: 1,
        fileName: s(p[125]),
        linkUrl: s(p[126]),
        title: s(p[127]),
      });
    }

    const descriptions: Array<{ label: string; body: string }> = [];
    const descDefs: Array<[number, string]> = [
      [94, "機能詳細1"],
      [95, "機能詳細2"],
      [96, "機能詳細3"],
      [97, "機能詳細4"],
      [98, "機能詳細5"],
    ];
    for (const [idx, label] of descDefs) {
      const body = s(p[idx]);
      if (body) descriptions.push({ label, body });
    }

    const variations: Array<Record<string, unknown>> = [];
    for (const r of allRows) {
      const vno = numInt(r[17]) ?? variations.length + 1;
      variations.push({
        variationNo: vno,
        skuCode: s(r[18]),
        axisName: "電球",
        optionValue: s(r[154]) ?? s(r[76]),
        modelNumber: rawS(r[24]), // 末尾スペースも現行出力(ページ名等)に効くため生値
        janCode: s(r[91]),
        price: numInt(r[48]) ?? numInt(r[29]),
        isRepresentative: r === p,
        sortNo: numInt(r[19]),
        detail: s(r[93]), // 行ごとの機能詳細(結合済み)。FS独自コメント(6)の電球タブ本文
        bulbColor: s(r[76]), // 行ごとの電球色(タブラベル用)
        bulbReplacement: s(r[59]), // 行ごとの電球1(タブ内アイコン用)
        eosFlag: s(r[4]) === "○", // 行の販売終了(E列)
        bulbKind2: s(r[74]), // 行の電球種類2
        bulbType: s(r[75]), // 行の電球の種類
        dimming: s(r[77]), // 行の調光方法
        relKey: `${s(r[7]) ?? ""}${s(r[9]) ?? ""}` || null, // メーカーID+通番(関連範囲判定)
        warrantyFlag: s(r[128]), // 行のfazoo延長保証
        shape: s(r[89]), // 行のカテゴリ(形)
        installEdw: s(r[12]), // 行の取付方法E/D/W
        mainBulbCount: numInt(r[60]), // 行ごとのメイン電球数(タブ内アイコン用)
        listed: s(r[0]) === "○", // 行の登録フラグ(FSページ名等の型番連結対象)
      });
    }

    const setComponents: Array<Record<string, unknown>> = [];
    if (s(p[30])) {
      setComponents.push({ componentModel: s(p[30]), role: "BULB", qty: numInt(p[60]) ?? 1 });
    }
    for (const col of [36, 42]) {
      if (s(p[col])) setComponents.push({ componentModel: s(p[col]), role: "PRODUCT", qty: 1 });
    }

    products.push({
      sheetRow: products.length + 1,
      productCode: parentCode,
      category,
      productKind: kind === "単品" && g.children.length === 0 ? "SINGLE" : "VARIATION_PARENT",
      makerCode: s(p[7]),
      seriesCode: s(p[10]),
      genreCode: s(p[12]),
      seqNo: numInt(p[9]),
      name: rawS(p[82]) ?? s(p[23]) ?? parentCode, // イメージ名は末尾スペースも現行出力に効くため生値
      summary: s(p[22]),
      modelNumber: rawS(p[24]), // 掲載用型番との一致判定(商品名)は生値同士で行う
      displayModelNumber: rawS(p[23]), // 掲載用型番(末尾スペース保持)
      warranty: s(p[128]), // 3年保証(○)。FSアイコン・レイアウト割当名に使用
      janCode: s(p[91]),
      status: plStatus(p),
      statusNote: s(p[5]),
      successorModel: rawS(p[133]), // 後継機種リンクのkeywordに生値が入る
      releaseDate: isoDate(p[90]),
      cost: numInt(p[26]),
      listPriceExTax: numInt(p[27]),
      listPriceInTax: numInt(p[28]),
      sellingPrice: numInt(p[29]),
      totalPrice: numInt(p[48]),
      supplier: s(p[25]),
      widthMm: numInt(p[50]),
      depthMm: numInt(p[51]),
      heightMm: numInt(p[52]),
      weightKg: numFloat(p[53]),
      totalHeightMinMm: numInt(p[54]),
      totalHeightMaxMm: numInt(p[55]),
      bodyColor: s(p[80]) ?? s(p[13]),
      comment: rawS(p[92]),
      detail: s(p[93]),
      descriptions: descriptions.length > 0 ? descriptions : null,
      isNew: flag(p[1]),
      isRecommended: flag(p[2]),
      memo: s(p[146]) ?? s(p[135]),
      extra: {
        yahooRakutenPublished: s(p[136]),
        catalog: s(p[148]),
        shopserveModel: s(p[134]),
        autoKeywords: s(p[129]),
        manualKeywords: s(p[130]),
        attachableCount: numInt(p[157]),
        plTemplateRelKey: templateFollows.get(parentCode),
      },
      lightingAttrs: {
        bulbType: s(p[75]),
        bulbKind: s(p[74]),
        initialBulbType: s(p[70]),
        bulbColor: s(p[76]),
        bulbBase: s(p[62]),
        mainBulbCount: numInt(p[60]),
        subBulb: s(p[61]),
        bulbReplacement: s(p[59]),
        bundledBulbModel: s(p[30]),
        brightnessLm: s(p[71]),
        colorTempLow: numInt(p[72]),
        colorTempHigh: numInt(p[73]),
        raValue: numInt(p[63]),
        wattEquivalent: s(p[64]),
        wattEquivalentTable: s(p[65]),
        dimmingMethod: s(p[77]),
        stepSwitching: flag(p[78]),
        pullSwitch: flag(p[68]),
        remoteIncluded: flag(p[69]),
        installationCode: s(p[12]),
        installationType: s(p[14]),
        installImage: s(p[79]), // 取付画像名(FS独自コメント(5)。値があれば固定4種より優先)
        inclinedCeiling: s(p[57]),
        highCeiling: flag(p[58]),
        cordStorage: s(p[56]),
        attachableCount: numInt(p[157]),
        tatami: s(p[66]),
        roomWholeLighting: flag(p[67]),
        material: s(p[81]),
        tags: {
          style1: s(p[83]),
          style2: s(p[84]),
          color: s(p[85]),
          type: s(p[86]),
          material1: s(p[87]),
          material2: s(p[88]),
          shape: s(p[89]),
        },
      },
      images,
      variations,
      setComponents,
    });
  }

  return { bookType: "PL", products, makers: [...makers.values()] };
}

// ---------- シーリングファン（.xlsb） ----------

const CF_SHEET = "シーリングファンデータ";

const CF_SET_MODEL_COLS: Array<[number, string]> = [
  [22, "FAN"],
  [23, "LIGHT"],
  [24, "PIPE"],
  [25, "FLANGE"],
  [26, "REMOTE"],
  [27, "BLADE"],
  [28, "OPTION"],
];

const CF_IMAGE_COLS: Array<[number, string, number]> = [
  [111, "MAIN", 1],
  [112, "MAIN", 2],
  ...Array.from({ length: 10 }, (_, i) => [118 + i, "IMAGE", i + 1] as [number, string, number]),
  [128, "SIZE", 1],
  [129, "SIZE", 2],
  ...Array.from({ length: 3 }, (_, i) => [130 + i, "FUNCTION", i + 1] as [number, string, number]),
  [133, "REMOTE", 1],
  [134, "ACCESSORY", 1],
  ...Array.from({ length: 4 }, (_, i) => [135 + i, "LIST", i + 1] as [number, string, number]),
  [139, "AD", 1],
  [140, "AD", 2],
  [141, "ORIGINAL", 1],
];

function cfStatus(row: Row): string {
  const st = s(row[2]) ?? ""; // 入荷予定(生産ステータス)
  const ident = numInt(row[9]); // 1:予約 2:セール 3:入荷予定
  if (st.includes("生産終了") || st.includes("販売終了") || st.includes("廃番")) {
    return "DISCONTINUED";
  }
  if (ident === 1) return "RESERVE";
  if (ident === 3 || (st.includes("入荷") && !st.includes("即日"))) return "BACKORDER";
  return "ACTIVE";
}

export function extractCf(wb: XLSX.WorkBook): ExtractResult {
  const rows = sheetRows(wb, CF_SHEET);
  const makers = new Map<string, MakerJson>();
  const products: ProductJson[] = [];

  for (let ri = 1; ri < rows.length; ri++) {
    const row: Row = [...(rows[ri] ?? [])];
    row.length = Math.max(row.length, 170);

    const code = s(row[15]); // ID商品管理
    const name = s(row[18]) ?? s(row[19]);
    if (!code || !name || !/^[A-Z]{2,4}\d+/.test(code)) continue;

    const makerCode = s(row[11]);
    if (makerCode && !makers.has(makerCode)) {
      makers.set(makerCode, { makerCode, nameJp: s(row[16]) ?? makerCode, nameEn: null, imgFolder: null });
    }

    const setComponents: Array<Record<string, unknown>> = [];
    for (const [col, role] of CF_SET_MODEL_COLS) {
      const model = s(row[col]);
      if (model) setComponents.push({ componentModel: model, role, qty: 1 });
    }

    const images: Array<Record<string, unknown>> = [];
    for (const [col, imageType, sortNo] of CF_IMAGE_COLS) {
      const fn = s(row[col]);
      if (fn) images.push({ imageType, sortNo, fileName: fn });
    }
    if (s(row[113])) images.push({ imageType: "FEATURE", sortNo: 1, fileName: s(row[113]) });
    if (s(row[114])) images.push({ imageType: "FEATURE", sortNo: 2, fileName: s(row[114]) });

    const variations: Array<Record<string, unknown>> = [];
    const axis = s(row[93]);
    for (let i = 0; i < 3; i++) {
      const vmodel = s(row[29 + i]);
      const opt = s(row[94 + i]);
      if (vmodel || opt) {
        variations.push({
          variationNo: i + 1,
          skuCode: `${code}v${i + 1}`,
          axisName: axis,
          optionValue: opt,
          modelNumber: vmodel,
          isRepresentative: i === 0,
          additionalLeadTime: s(row[99 + i]),
          imageName: i === 0 ? s(row[102]) : null,
        });
      }
    }
    if (variations.length === 0) {
      variations.push({
        variationNo: 1,
        skuCode: `${code}v1`,
        modelNumber: s(row[21]) ?? s(row[20]),
        isRepresentative: true,
      });
    }

    const descriptions: Array<{ label: string; body: string }> = [];
    for (const [idx, label] of [
      [85, "サブ紹介文_個別"],
      [87, "サブ紹介文2"],
    ] as Array<[number, string]>) {
      const body = s(row[idx]);
      if (body) descriptions.push({ label, body });
    }

    const amazonPrice = numInt(row[47]);

    products.push({
      sheetRow: products.length + 1,
      productCode: code,
      category: "CEILING_FAN",
      productKind: setComponents.length > 0 ? "SET" : "SINGLE",
      makerCode,
      seriesCode: s(row[12]),
      genreCode: s(row[13]),
      seqNo: numInt(row[14]),
      name,
      summary: s(row[18]) ? s(row[19]) : null,
      modelNumber: s(row[21]),
      combinationModel: s(row[20]),
      janCode: s(row[37]),
      status: cfStatus(row),
      statusNote: s(row[2]),
      successorModel: s(row[3]),
      cost: numInt(row[43]),
      costInTax: numInt(row[44]),
      listPriceExTax: numInt(row[39]),
      listPriceInTax: numInt(row[40]),
      sellingPriceExTax: numInt(row[45]),
      sellingPrice: numInt(row[46]),
      totalPrice: numInt(row[46]),
      priceControlled: flag(row[38]),
      taxType: s(row[49]) === "税込" ? "TAX_INCLUDED" : "TAX_EXCLUDED",
      pointRate: numFloat(row[50]),
      supplier: s(row[42]),
      shippingEstimate: numInt(row[51]),
      widthMm: numInt(row[32]),
      heightMm: numInt(row[33]),
      height2Mm: numInt(row[34]),
      weightKg: numFloat(row[36]),
      warranty: s(row[80]),
      moneyBackDays: flag(row[81]) ? 90 : null,
      countryOfOrigin: s(row[82]),
      goodDesignYear: numInt(row[83]),
      bodyColor: s(row[67]),
      comment: s(row[84]),
      detail: s(row[86]),
      descriptions: descriptions.length > 0 ? descriptions : null,
      videoHtmls:
        s(row[115]) || s(row[116]) || s(row[117])
          ? { fs: s(row[115]), yahoo: s(row[116]), rakuten: s(row[117]) }
          : null,
      isNew: s(row[88]) === "Y",
      isRecommended: flag(row[89]),
      isSameDayShipping: (s(row[2]) ?? "").includes("即日"),
      flags: s(row[90]) ? { misc: s(row[90]) } : null,
      sortNo: numInt(row[91]),
      shippingLeadTime: s(row[98]),
      fsShippingPattern: s(row[97]),
      relatedProducts: s(row[92]),
      exampleUrl: s(row[142]),
      memo: s(row[5]) ?? s(row[103]),
      extra: {
        priority: s(row[1]),
        amazonDeleteFlag: s(row[4]),
        denaPrice: numInt(row[48]),
        yahooListPriceUrl: s(row[143]),
        series: s(row[147]),
        singleFlag: s(row[145]),
      },
      channelPrices: amazonPrice ? [{ channelCode: "amazon", price: amazonPrice }] : [],
      fanAttrs: {
        motorType: s(row[55]),
        bladeCount: numInt(row[56]),
        windSpeed: numFloat(row[57]),
        windVolume: numFloat(row[58]),
        rotationSpeed: numInt(row[59]),
        windLevels: numInt(row[60]),
        powerConsumptionW: numFloat(row[54]),
        extensionPipe: s(row[61]),
        pipeVariation: s(row[62]),
        mountType: s(row[10]),
        heightToBladeMm: numInt(row[35]),
        lightCount: numInt(row[63]),
        lightKind: s(row[64]),
        lightColor: s(row[65]),
        bladeColor1: s(row[68]),
        bladeColor2: s(row[69]),
        colorCategory: s(row[66]),
        rhythmMode: flag(row[70]),
        dimming: s(row[71]),
        remoteIncluded: flag(row[72]),
        batteryType: s(row[73]),
        batteryCount: numInt(row[74]),
        brightnessLm: numInt(row[76]),
        wattEquivalent: s(row[75]),
        tatamiFrom: numInt(row[77]),
        tatamiTo: numInt(row[78]),
        angledCeiling: s(row[79]),
        fanGrade: s(row[104]),
        installVideoType: s(row[104]),
        installNotes: {
          rosette: s(row[105]),
          partialElectric: s(row[106]),
          rosette2: s(row[107]),
          boltFixing: s(row[108]),
          other: s(row[109]),
          note: s(row[110]),
        },
      },
      images,
      variations,
      setComponents,
    });
  }

  return { bookType: "CF", products, makers: [...makers.values()] };
}

// ---------- エントリポイント（シート名でブック種別を自動判定） ----------

export function extractWorkbook(buffer: Buffer): ExtractResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  if (wb.SheetNames.includes(CF_SHEET)) return extractCf(wb);
  if (wb.SheetNames.includes(PL_SHEET)) return extractPl(wb);
  throw new Error(
    `対応するシートが見つかりません（「${CF_SHEET}」または「${PL_SHEET}」が必要です）`
  );
}
