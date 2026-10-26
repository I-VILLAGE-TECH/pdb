// futureshop 以外の連携先(Yahoo / 楽天 / Amazon 等)のファイル出力定義
// 現行マクロはボタン1つで複数のファイル(Yahoo: 商品・在庫・削除、Amazon: IV・SD 等)を作り、
// ファイルごとに区切り文字・クォート・文字コード・拡張子・ファイル名・分割件数が違う。
// それを「ファイル種別の定義(MallFileSpec)」と「ボタン相当のセット(MallSetSpec)」で表す。
// 連携先ごとの定義は lib/mall/*.ts に置き、ここで集約する(routes/exports.ts・エクスポート画面・CLI が共通で使う)。
import iconv from "iconv-lite";
import type { Prisma } from "@prisma/client";
import { YAHOO_FILE_SPECS, YAHOO_SET_SPECS } from "./mall/yahoo.js";
import { RAKUTEN_FILE_SPECS, RAKUTEN_SET_SPECS } from "./mall/rakuten.js";
import { AMAZON_FILE_SPECS, AMAZON_SET_SPECS } from "./mall/amazon.js";

export type ProductFull = Prisma.ProductGetPayload<{
  include: {
    maker: true;
    lightingAttrs: true;
    fanAttrs: true;
    variations: true;
    images: true;
    channelPrices: true;
    setComponents: true;
  };
}>;
type ChannelWithMaps = Prisma.ChannelGetPayload<{ include: { fieldMaps: true } }>;

export type MallFileFormat = {
  delimiter: "," | "\t";
  // auto: 区切り文字・"・改行を含む値だけ "" で囲む / none: 囲まない(楽天の現行実装) / all: 全項目を囲む
  quote: "auto" | "none" | "all";
  charset: "SHIFT_JIS" | "UTF8";
  bom?: boolean; // UTF8 のとき BOM を付けるか
  lineEnd?: "\r\n" | "\n"; // 既定 CRLF
  extension: "csv" | "txt";
};

export type MallContext = {
  channel: ChannelWithMaps;
  // 商品CSV(channel_field_maps)の func: 変換関数を呼ぶ(FS用の商品名などを流用したい場合)
  func: (name: string, p: ProductFull, v: ProductFull["variations"][number]) => string;
  isPL: (p: ProductFull) => boolean;
};

export type MallFileSpec = {
  channel: string; // channels.code
  fileType: string; // API/画面で使うキー(英小文字・数字・_)
  label: string; // 画面表示名
  book: "PL" | "CF" | "ANY"; // 対象ブック(PL=「XX-9999」形式の商品コード / CF=それ以外)
  format: MallFileFormat;
  splitRows?: number; // 超過時に分割(各ファイルにヘッダー行)。未指定なら分割しない
  // ファイル名(拡張子なし)。stamp は yyyymmddHHMMSS(JST)。index は分割時の 1..N(分割なしは null)
  fileName: (stamp: string, index: number | null) => string;
  header: string[];
  // 先頭に置く固定行(Amazon のフラットファイルのテンプレート行など)。ヘッダー行より前に出す
  preamble?: string[][];
  // 対象商品(ブックで絞り込み済み・シート順)から行を作る
  generate: (products: ProductFull[], ctx: MallContext) => string[][] | Promise<string[][]>;
};

// ボタン1回分(複数ファイルをZIPで)
export type MallSetSpec = {
  channel: string;
  fileType: string;
  label: string;
  book: "PL" | "CF" | "ANY";
  members: string[]; // MallFileSpec.fileType
  zipName: (stamp: string) => string;
};

export const MALL_FILE_SPECS: MallFileSpec[] = [...YAHOO_FILE_SPECS, ...RAKUTEN_FILE_SPECS, ...AMAZON_FILE_SPECS];
export const MALL_SET_SPECS: MallSetSpec[] = [...YAHOO_SET_SPECS, ...RAKUTEN_SET_SPECS, ...AMAZON_SET_SPECS];

export function findMallFileSpec(channel: string, fileType: string): MallFileSpec | undefined {
  return MALL_FILE_SPECS.find((s) => s.channel === channel && s.fileType === fileType);
}
export function findMallSetSpec(channel: string, fileType: string): MallSetSpec | undefined {
  return MALL_SET_SPECS.find((s) => s.channel === channel && s.fileType === fileType);
}

// エクスポート画面に出す種別一覧(セットを先に、続いて単体ファイル)
export function mallFileTypeOptions(channel: string): Array<{ key: string; label: string; book: string; isSet: boolean }> {
  return [
    ...MALL_SET_SPECS.filter((s) => s.channel === channel).map((s) => ({ key: s.fileType, label: s.label, book: s.book, isSet: true })),
    ...MALL_FILE_SPECS.filter((s) => s.channel === channel).map((s) => ({ key: s.fileType, label: s.label, book: s.book, isSet: false })),
  ];
}

function field(v: string, f: MallFileFormat): string {
  if (f.quote === "none") return v;
  if (f.quote === "all") return `"${v.replace(/"/g, '""')}"`;
  return v.includes(f.delimiter) || /["\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function buildMallFile(spec: MallFileSpec, rows: string[][]): Buffer {
  const f = spec.format;
  const eol = f.lineEnd ?? "\r\n";
  const lines = [...(spec.preamble ?? []), spec.header, ...rows].map((r) => r.map((v) => field(v, f)).join(f.delimiter));
  const text = lines.join(eol) + eol;
  if (f.charset === "SHIFT_JIS") return iconv.encode(text, "Shift_JIS");
  return Buffer.from((f.bom ? "﻿" : "") + text, "utf8");
}

// 分割: splitRows 超過時のみ。ファイル名は spec.fileName で決める
export function buildMallFiles(spec: MallFileSpec, rows: string[][], stamp: string): Array<{ name: string; body: Buffer }> {
  const limit = spec.splitRows;
  if (!limit || rows.length <= limit) {
    return [{ name: `${spec.fileName(stamp, null)}.${spec.format.extension}`, body: buildMallFile(spec, rows) }];
  }
  const out: Array<{ name: string; body: Buffer }> = [];
  for (let i = 0, n = 1; i < rows.length; i += limit, n++) {
    out.push({ name: `${spec.fileName(stamp, n)}.${spec.format.extension}`, body: buildMallFile(spec, rows.slice(i, i + limit)) });
  }
  return out;
}

export function mallContentType(spec: MallFileSpec): string {
  const type = spec.format.extension === "txt" ? "text/plain" : "text/csv";
  return `${type}; charset=${spec.format.charset === "SHIFT_JIS" ? "Shift_JIS" : "utf-8"}`;
}
