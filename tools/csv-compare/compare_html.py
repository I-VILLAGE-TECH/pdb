#!/usr/bin/env python3
"""HTML出力(SPEC / 製品画像)の並行出力比較: 正解フォルダと出力フォルダをファイル単位でバイト比較する。

使い方: python3 compare_html.py <正解フォルダ> <出力フォルダ> [--show N]
  - ファイル名(大文字小文字無視・NFC正規化)で対応付け、内容をバイト単位で比較する
  - 不一致は最初に異なる行を表示する(--show 件数まで)
"""
import argparse
import os
import sys
import unicodedata


def files(d):
    out = {}
    for name in os.listdir(d):
        if name.lower().endswith(".html"):
            out[unicodedata.normalize("NFC", name).lower()] = os.path.join(d, name)
    return out


def first_diff(a, b):
    la = a.split(b"\n")
    lb = b.split(b"\n")
    for i in range(max(len(la), len(lb))):
        x = la[i] if i < len(la) else None
        y = lb[i] if i < len(lb) else None
        if x != y:
            return i + 1, x, y
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("expected")
    ap.add_argument("actual")
    ap.add_argument("--show", type=int, default=5)
    args = ap.parse_args()
    exp = files(args.expected)
    act = files(args.actual)
    common = sorted(set(exp) & set(act))
    only_exp = sorted(set(exp) - set(act))
    only_act = sorted(set(act) - set(exp))
    same = 0
    diffs = []
    for k in common:
        a = open(exp[k], "rb").read()
        b = open(act[k], "rb").read()
        if a == b:
            same += 1
        else:
            diffs.append((k, first_diff(a, b)))
    print(f"共通 {len(common)} 件: 一致 {same} / 不一致 {len(diffs)}"
          f"  ({(same / len(common) * 100 if common else 0):.2f}%)")
    print(f"正解のみ {len(only_exp)} 件 / 出力のみ {len(only_act)} 件")
    if only_exp:
        print("  正解のみ(先頭):", ", ".join(only_exp[:10]))
    if only_act:
        print("  出力のみ(先頭):", ", ".join(only_act[:10]))
    for k, d in diffs[: args.show]:
        line, x, y = d
        dec = lambda v: None if v is None else v.decode("utf-8", "replace")
        print(f"--- {k} 行{line}\n  正解: {dec(x)!r}\n  出力: {dec(y)!r}")
    sys.exit(0 if not diffs else 1)


if __name__ == "__main__":
    main()
