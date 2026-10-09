#!/usr/bin/env python3
"""並行出力比較: 現行Excel(VBA)出力CSV と product-db 出力CSV をセル単位で比較する。

手順は documents/02_検討事項/01_全体/05_並行出力比較_テスト手順.md(工程5)。
- 分割ファイル(_1.._N)は連結して1つの表として扱う(各ファイルのヘッダー行は1行目のみ採用)
- 行の突合はキー列(既定: 商品URLコード)でグループ化し、同一キー内は出現順で対応づける
  (--sort-within-key でキー内の行を並べ替えてから比較。行順に意味のないCSV向け)
- 文字コードは cp932。現行CSVに含まれる不正バイトは置換文字(U+FFFD)にして比較する

使い方:
  python3 compare.py --expected 'tmp/シーリングファン/03_*/FSグループひもづけ用_*.csv' --actual out/cf_category.csv
  python3 compare.py ... --json diff.json   # 全差分をJSONで保存
"""

import argparse
import csv
import glob
import io
import json
import re
import sys
import unicodedata
from collections import Counter, OrderedDict


def natural_key(path):
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", path)]


def read_csv(paths):
    header = None
    rows = []
    bad = 0
    for p in paths:
        raw = open(p, "rb").read()
        text = raw.decode("cp932", errors="replace")
        bad += text.count("\ufffd")
        if text.startswith("\ufeff"):
            text = text[1:]
        recs = list(csv.reader(io.StringIO(text, newline="")))
        if not recs:
            continue
        if header is None:
            header = recs[0]
        rows.extend(recs[1:])
    return header or [], rows, bad


def expand(patterns):
    files = []
    for pat in patterns:
        # macOSのファイル名はNFD(濁点分離)で保存されるため、NFCのパターンで当たらなければNFDでも探す
        hit = glob.glob(pat) or glob.glob(unicodedata.normalize("NFD", pat))
        hit = sorted(hit, key=natural_key)
        if not hit:
            sys.exit(f"ファイルが見つかりません: {pat}")
        files.extend(hit)
    return files


def group(rows, key_idx):
    g = OrderedDict()
    for r in rows:
        k = r[key_idx] if key_idx < len(r) else ""
        g.setdefault(k, []).append(r)
    return g


def short(s, n=160):
    s = s.replace("\r", "\\r").replace("\n", "\\n")
    return s if len(s) <= n else s[:n] + f"…(+{len(s) - n})"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--expected", nargs="+", required=True, help="現行出力CSV(glob可・複数可)")
    ap.add_argument("--actual", nargs="+", required=True, help="product-db出力CSV(glob可)")
    ap.add_argument("--key", default="商品URLコード", help="突合キーの列名")
    ap.add_argument("--sort-within-key", action="store_true", help="キー内の行を並べ替えて比較")
    ap.add_argument("--only-common", action="store_true", help="両方にあるキーのみ比較(片側のみのキーは件数だけ表示)")
    ap.add_argument("--examples", type=int, default=3, help="列ごとの差分例の件数")
    ap.add_argument("--json", help="全差分の保存先")
    a = ap.parse_args()

    eh, er, ebad = read_csv(expand(a.expected))
    ah, ar, abad = read_csv(expand(a.actual))
    print(f"expected: {len(er)} rows / {len(eh)} cols (不正バイト {ebad})")
    print(f"actual  : {len(ar)} rows / {len(ah)} cols (不正バイト {abad})")
    if eh != ah:
        print("!! ヘッダー不一致")
        for i in range(max(len(eh), len(ah))):
            x = eh[i] if i < len(eh) else "(なし)"
            y = ah[i] if i < len(ah) else "(なし)"
            if x != y:
                print(f"   col{i + 1}: expected={x!r} actual={y!r}")
    if a.key not in eh or a.key not in ah:
        sys.exit(f"キー列 {a.key} がありません")
    eg = group(er, eh.index(a.key))
    ag = group(ar, ah.index(a.key))

    only_e = [k for k in eg if k not in ag]
    only_a = [k for k in ag if k not in eg]
    common = [k for k in eg if k in ag]
    print(f"keys: expected={len(eg)} actual={len(ag)} common={len(common)} "
          f"expectedのみ={len(only_e)} actualのみ={len(only_a)}")
    if only_e:
        print(f"   expectedのみ 例: {only_e[:10]}")
    if only_a:
        print(f"   actualのみ 例: {only_a[:10]}")

    cols = [c for c in eh if c in ah]
    ei = {c: eh.index(c) for c in cols}
    ai = {c: ah.index(c) for c in cols}
    col_diff = Counter()
    col_examples = {}
    rowcount_diff = []
    cells = 0
    same = 0
    details = []
    for k in common:
        xs, ys = eg[k], ag[k]
        if a.sort_within_key:
            xs, ys = sorted(xs), sorted(ys)
        if len(xs) != len(ys):
            rowcount_diff.append((k, len(xs), len(ys)))
        for n in range(min(len(xs), len(ys))):
            x, y = xs[n], ys[n]
            for c in cols:
                ev = x[ei[c]] if ei[c] < len(x) else ""
                av = y[ai[c]] if ai[c] < len(y) else ""
                cells += 1
                if ev == av:
                    same += 1
                    continue
                col_diff[c] += 1
                col_examples.setdefault(c, [])
                if len(col_examples[c]) < a.examples:
                    col_examples[c].append((k, n, ev, av))
                details.append({"key": k, "row": n, "col": c, "expected": ev, "actual": av})

    if rowcount_diff:
        print(f"キー内の行数不一致: {len(rowcount_diff)}件 例: {rowcount_diff[:8]}")
    pct = (same / cells * 100) if cells else 100.0
    print(f"cells: {same}/{cells} 一致 ({pct:.2f}%)  差分列: {len(col_diff)}")
    for c, n in col_diff.most_common():
        print(f"  [{n:>6}] {c}")
        for k, row, ev, av in col_examples[c]:
            # 長いセルは最初に食い違う位置の前後を表示
            pos = next((i for i, (x, y) in enumerate(zip(ev, av)) if x != y), min(len(ev), len(av)))
            start = max(0, pos - 60) if len(ev) > 160 or len(av) > 160 else 0
            where = f" @{pos}/{len(ev)}:{len(av)}" if start else ""
            print(f"       {k}#{row}{where}")
            print(f"         E: {short(ev[start:])}")
            print(f"         A: {short(av[start:])}")
    if a.json:
        with open(a.json, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "only_expected": only_e,
                    "only_actual": only_a,
                    "rowcount_diff": rowcount_diff,
                    "diffs": details,
                },
                f,
                ensure_ascii=False,
                indent=1,
            )


if __name__ == "__main__":
    main()
