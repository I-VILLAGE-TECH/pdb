#!/usr/bin/env python3
"""楽天 GAS の定数(00_Constants.js)と販売用説明文の HTML テンプレートを、product-db の TypeScript に写す。
使い方: python3 tools/gas-rakuten/generate-ts.py <GASフォルダ>
出力: server/src/lib/rakuten/gasConstants.ts・gasTemplates.ts(手で編集しない。GAS が変わったら再生成する)
"""
import json, os, re, sys

gas = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
out_dir = os.path.join(here, "../../server/src/lib/rakuten")

src = open(os.path.join(gas, "00_Constants.js"), encoding="utf-8").read().split("\n")

def block(name):
    """トップレベルの `const NAME = {` から対応する `};` までを返す"""
    start = next(i for i, l in enumerate(src) if l.startswith(f"const {name} = "))
    for j in range(start, len(src)):
        if src[j].startswith("}"):
            return src[start : j + 1]
    raise SystemExit(f"{name} の終わりが見つかりません")

parts = []
for name in ["CONFIG", "SHOP", "SHOP_DATA", "CONFIG_RAKUTEN_CMN", "CONFIG_RAKUTEN"]:
    lines = block(name)
    lines[0] = lines[0].replace(f"const {name} = ", f"export const {name}: any = ", 1)
    parts.append("\n".join(lines))

header = (
    "// 自動生成(tools/gas-rakuten/generate-ts.py)。手で編集しない\n"
    "// 楽天スプレッドシートの GAS「00_Constants.js」のうち、楽天出力で使う定数をそのまま写したもの\n"
    "// (商品マスタDB・NE 用の定数は対象外)。列位置は楽天シートの列(CF は台帳の「ダクトレール取り付け」列が無い並び)\n"
    "// GAS は同じキーを重ねて書いている箇所がある(JS では後勝ち)。TS ではエラーになるため型チェックを外す\n"
    "// @ts-nocheck\n"
)
open(os.path.join(out_dir, "gasConstants.ts"), "w", encoding="utf-8").write(header + "\n\n".join(parts) + "\n")

tpl = {
    "CF_SALES_DESC_TEMPLATE": "楽天_CF販売用説明文HTML.html",
    "PL_SALES_DESC_TEMPLATE": "楽天_PL販売用説明文HTML.html",
}
body = "// 自動生成(tools/gas-rakuten/generate-ts.py)。手で編集しない\n// 楽天 GAS の販売用説明文テンプレート(HtmlService の <? ?> 形式)をそのまま写したもの\n\n"
for const, fname in tpl.items():
    text = open(os.path.join(gas, fname), encoding="utf-8").read()
    body += f"export const {const} = {json.dumps(text, ensure_ascii=False)};\n\n"
open(os.path.join(out_dir, "gasTemplates.ts"), "w", encoding="utf-8").write(body)
print("generated")
