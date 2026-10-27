#!/usr/bin/env python3
"""楽天 CSV(GAS の正解 / product-db の出力)をセル単位で比較する。
1商品 = 商品行 + SKU行(複数) + オプション行。行は「商品管理番号 + 行種別 + 同種別内の順番」で対応付ける。
使い方: python3 compare-rakuten.py <正解.csv> <出力.csv> [--show N]
"""
import csv, io, sys, collections

def load(path):
    rows = list(csv.reader(io.StringIO(open(path, encoding="utf-8", newline="").read())))
    header, body = rows[0], rows[1:]
    keyed = {}
    seen = collections.Counter()
    for r in body:
        r = r + [""] * (len(header) - len(r))
        # 行種別: 商品名(列3)があれば商品行、SKU 管理番号の列に値があれば SKU 行、それ以外はオプション行
        kind = "P" if len(r) > 2 and r[2] else ("S" if any(r[i] for i in range(3, len(r)) if "SKU" in header[i]) else "O")
        k = (r[0], kind)
        seen[k] += 1
        keyed[(r[0], kind, seen[k])] = r
    return header, keyed

def main():
    exp_path, act_path = sys.argv[1], sys.argv[2]
    show = int(sys.argv[sys.argv.index("--show") + 1]) if "--show" in sys.argv else 10
    he, e = load(exp_path)
    ha, a = load(act_path)
    if he != ha:
        print("見出しが一致しません")
    common = sorted(set(e) & set(a))
    total = same = 0
    diffs = collections.Counter()
    samples = []
    for k in common:
        for i, h in enumerate(he):
            total += 1
            if e[k][i] == a[k][i]:
                same += 1
            else:
                diffs[h] += 1
                if len(samples) < show:
                    samples.append((k, h, e[k][i][:150], a[k][i][:150]))
    print(f"共通 {len(common)} 行 / 正解のみ {len(set(e) - set(a))} 行 / 出力のみ {len(set(a) - set(e))} 行")
    print(f"セル一致 {same}/{total} ({100 * same / max(total, 1):.2f}%)")
    for h, n in diffs.most_common(15):
        print(f"  {n:6} {h}")
    for k, h, x, y in samples:
        print(f"--- {k} {h}\n  正解: {x!r}\n  出力: {y!r}")
    only_e = sorted(set(e) - set(a))[:5]
    only_a = sorted(set(a) - set(e))[:5]
    if only_e: print("正解のみ(先頭):", only_e)
    if only_a: print("出力のみ(先頭):", only_a)

main()
