# Yahoo(PL)スプレッドシート(GAS)の並行比較ツール

Yahoo のペンダントライト(PL)の CSV と画像は、現行では Yahoo(PL)スプレッドシート「（Yahooペンダントライト用）商品情報更新データ作成」の GAS で作っている。
product-db はこれを移植した(`server/src/lib/yahoo/`)。ここには、現行の GAS をそのまま Node で動かして正解を作り、product-db の出力と比べるための道具を置く。
GAS を動かす代用品は楽天と共通(`tools/gas-rakuten/gasRuntime.mjs`)。

GAS のソース・スプレッドシート・台帳は業務データのため `tmp/` に置き、リポジトリには入れない。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `run-yahoo-pl.mjs` | GAS を実行して、CSV(新規登録・価格更新・在庫変更)と画像リネームのコピー先(正解)を作る |
| `generate-ts.py` | GAS の定数(`00_Constants.js`・`Yahoo用定数定義.js`)と説明文テンプレートを `server/src/lib/yahoo/gasConstants.ts`・`gasTemplates.ts` に写す |

## 使い方

```bash
cd product-db
# 1. 正解を作る(台帳の登録フラグ○の全行。Yahoo シートは台帳「ペンダントライト一覧」と同じ並び)
node tools/gas-yahoo/run-yahoo-pl.mjs --gas "tmp/Yahoo・PL(GAS)" --book "tmp/（Yahooペンダントライト用）商品情報更新データ作成.xlsx" \
  --out /tmp/ys_ref --pl-ledger tmp/ペンダントライト/ペンダントライト一覧_20260929.xlsm

# 2. product-db 側に同じ台帳を取り込んでおく(楽天の比較と同じ)
cd server
npx tsx src/scripts/import-excel.ts "../tmp/ペンダントライト/ペンダントライト一覧_20260929.xlsm"

# 3. product-db から出力して比べる(UTF-8 で書き出すので、そのままバイト比較できる)
npx tsx src/scripts/export-yahoo-pl.ts --type yahoo_new_pl --out /tmp/ys_db
cmp /tmp/ys_ref/pl_new.csv /tmp/ys_db/yahoo_new_pl.csv
```

価格更新・在庫変更は `--type yahoo_price_pl` / `yahoo_stock_pl` と `pl_price.csv` / `pl_stock.csv`。
生産終了は現行の GAS では出力できない(Main.js の呼び出しの引数がずれている)ため、正解は作れない。

GAS が変わったら `python3 tools/gas-yahoo/generate-ts.py "tmp/Yahoo・PL(GAS)"` で定数・テンプレートを写し直し、ロジックの差分は
`server/src/lib/yahoo/yahooPlCsv.ts` に手で反映する。
