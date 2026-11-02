#!/usr/bin/env python3
"""Yahoo(PL) GAS の定数(00_Constants.js・Yahoo用定数定義.js)と商品説明文の HTML テンプレートを、product-db の TypeScript に写す。
使い方: python3 tools/gas-yahoo/generate-ts.py <GASフォルダ>
出力: server/src/lib/yahoo/gasConstants.ts・gasTemplates.ts(手で編集しない。GAS が変わったら再生成する)
"""
import json, os, sys

gas = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
out_dir = os.path.join(here, "../../server/src/lib/yahoo")
os.makedirs(out_dir, exist_ok=True)

def block(src, name):
    """トップレベルの `const NAME = {` から対応する `};` までを返す"""
    start = next(i for i, l in enumerate(src) if l.startswith(f"const {name} = "))
    for j in range(start, len(src)):
        if src[j].startswith("}"):
            return src[start : j + 1]
    raise SystemExit(f"{name} の終わりが見つかりません")

parts = []
for fname, names in [
    ("00_Constants.js", ["CONFIG", "SHOP", "SHOP_DATA", "CONFIG_RAKUTEN_CMN", "CONFIG_RAKUTEN"]),
    ("Yahoo用定数定義.js", ["CONFIG_YAHOO_CMN", "CONFIG_YAHOO"]),
]:
    src = open(os.path.join(gas, fname), encoding="utf-8").read().split("\n")
    for name in names:
        lines = block(src, name)
        lines[0] = lines[0].replace(f"const {name} = ", f"export const {name}: any = ", 1)
        parts.append("\n".join(lines))

header = (
    "// 自動生成(tools/gas-yahoo/generate-ts.py)。手で編集しない\n"
    "// Yahoo(PL)スプレッドシートの GAS「00_Constants.js」「Yahoo用定数定義.js」のうち、Yahoo 出力で使う定数をそのまま写したもの\n"
    "// (楽天スプレッドシートの GAS を複製して作られたため、楽天用の定数も含む。画像の列一覧は CONFIG_RAKUTEN を使っている)\n"
    "// 列位置は Yahoo シートの列(台帳「ペンダントライト一覧」と同じ並び)\n"
    "// GAS は同じキーを重ねて書いている箇所がある(JS では後勝ち)。TS ではエラーになるため型チェックを外す\n"
    "// @ts-nocheck\n"
)
open(os.path.join(out_dir, "gasConstants.ts"), "w", encoding="utf-8").write(header + "\n\n".join(parts) + "\n")

body = "// 自動生成(tools/gas-yahoo/generate-ts.py)。手で編集しない\n// Yahoo(PL) GAS の商品説明文テンプレート(HtmlService の <? ?> 形式)をそのまま写したもの\n\n"
text = open(os.path.join(gas, "Yahoo_PL販売用説明文HTML.html"), encoding="utf-8").read()
body += f"export const YAHOO_PL_DESC_TEMPLATE = {json.dumps(text, ensure_ascii=False)};\n"
open(os.path.join(out_dir, "gasTemplates.ts"), "w", encoding="utf-8").write(body)
print("generated")
