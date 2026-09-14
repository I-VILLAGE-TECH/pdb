// APIクライアント（fetchの薄いラッパ）

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // セッション切れは全画面共通でログインへ（ログインAPI自身を除く）
    if (res.status === 401 && !path.startsWith("/api/auth/")) {
      window.location.href = "/login";
    }
    throw new ApiError(body.error ?? `HTTP ${res.status}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: "ADMIN" | "EDITOR";
  lastLoginAt: string | null;
};

export type ManagedUser = AuthUser & { active: boolean; createdAt: string };

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "管理者",
  EDITOR: "編集者",
};

// ---- 型（APIレスポンスの主要形） ----

export type Maker = {
  id: number;
  makerCode: string;
  nameJp: string;
  nameEn: string | null;
  imgFolder: string | null;
  sortLevel: number;
  _count?: { products: number };
};

export type Variation = {
  id: number;
  variationNo: number;
  skuCode: string;
  axisName: string | null;
  optionValue: string | null;
  modelNumber: string | null;
  janCode: string | null;
  stockQty: number;
  price: number | null;
  isRepresentative: boolean;
};

export type Product = {
  id: number;
  productCode: string;
  category: "PENDANT_LIGHT" | "CEILING_LIGHT" | "CEILING_FAN" | "OTHER";
  productKind: "SINGLE" | "VARIATION_PARENT" | "SET" | "COMPONENT";
  name: string;
  summary: string | null;
  modelNumber: string | null;
  combinationModel: string | null;
  janCode: string | null;
  status: string;
  statusNote: string | null;
  successorModel: string | null;
  cost: number | null;
  listPriceExTax: number | null;
  listPriceInTax: number | null;
  sellingPrice: number | null;
  totalPrice: number | null;
  supplier: string | null;
  widthMm: number | null;
  depthMm: number | null;
  heightMm: number | null;
  weightKg: string | null;
  warranty: string | null;
  bodyColor: string | null;
  comment: string | null;
  detail: string | null;
  memo: string | null;
  isNew: boolean;
  isRecommended: boolean;
  isSameDayShipping: boolean;
  // 追加の表示項目（一覧の全項目ピッカーで使用）
  costInTax: number | null;
  sellingPriceExTax: number | null;
  pointRate: string | null;
  shippingEstimate: number | null;
  height2Mm: number | null;
  totalHeightMinMm: number | null;
  totalHeightMaxMm: number | null;
  moneyBackDays: number | null;
  countryOfOrigin: string | null;
  goodDesignYear: number | null;
  sortNo: number | null;
  shippingLeadTime: string | null;
  fsShippingPattern: string | null;
  relatedProducts: string | null;
  exampleUrl: string | null;
  seriesCode: string | null;
  genreCode: string | null;
  updatedAt: string;
  maker: Maker | null;
  makerId: number | null;
  variations: Variation[];
  images: Array<{
    id: number;
    imageType: string;
    sortNo: number;
    fileName: string;
    url: string | null;
  }>;
  lightingAttrs?: Record<string, unknown> | null;
  fanAttrs?: Record<string, unknown> | null;
  setComponents?: Array<{
    id: number;
    componentModel: string;
    role: string;
    qty: number;
    componentProduct: { id: number; productCode: string; name: string; totalPrice: number | null } | null;
  }>;
  channelLinks?: Array<{
    id: number;
    channel: { code: string; name: string };
    diffStatus: string;
    linkStatus: string;
    lastSentAt: string | null;
  }>;
};

export type Paged<T> = { total: number; page: number; perPage: number; items: T[] };

export const CATEGORY_LABEL: Record<string, string> = {
  PENDANT_LIGHT: "ペンダントライト",
  CEILING_LIGHT: "シーリングライト",
  CEILING_FAN: "シーリングファン",
  OTHER: "その他",
};

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "販売中",
  HIDDEN: "非公開",
  DISCONTINUED: "生産終了",
  DISCONTINUED_IN_STOCK: "終了・在庫有",
  BACKORDER: "入荷待ち",
  RESERVE: "予約",
};

export const KIND_LABEL: Record<string, string> = {
  SINGLE: "単品",
  VARIATION_PARENT: "バリエーション親",
  SET: "セット",
  COMPONENT: "構成部材",
};

export const DIFF_LABEL: Record<string, string> = {
  NONE: "✅ 同期済み",
  UNREGISTERED: "🆕 未登録",
  LOCAL_CHANGED: "✏️ 未反映",
  REMOTE_DRIFT: "⚠️ 連携先が変更",
  BOTH: "⚠️ 両方変更",
};

export function yen(v: number | null | undefined): string {
  return v == null ? "-" : `¥${v.toLocaleString()}`;
}
