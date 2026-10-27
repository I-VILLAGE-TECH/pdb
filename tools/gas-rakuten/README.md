# 楽天スプレッドシート(GAS)の並行比較ツール

楽天の CSV は、現行では楽天スプレッドシートの GAS(Apps Script)で作っている。product-db はこれを移植した(`server/src/lib/rakuten/`)。
ここには、現行の GAS をそのまま Node で動かして正解を作り、product-db の出力と比べるための道具を置く。

GAS のソース・スプレッドシート・台帳は業務データのため `tmp/` に置き、リポジトリには入れない。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `gasRuntime.mjs` | GAS を Node の vm で動かすための最小限の代用品(SpreadsheetApp・HtmlService・Utilities・DriveApp) |
| `run-rakuten.mjs` | GAS を実行して楽天 CSV(新規登録・価格更新 × PL・CF)の正解を作る |
| `generate-ts.py` | GAS の定数(`00_Constants.js`)と説明文テンプレートを `server/src/lib/rakuten/gasConstants.ts`・`gasTemplates.ts` に写す |
| `compare-rakuten.py` | 楽天 CSV をセル単位で比べる(行は「商品管理番号 + 行種別(商品/SKU/オプション) + 順番」で対応付け) |

## 使い方

```bash
cd product-db
# 1. 正解を作る(台帳の登録フラグ○の全行。CF は楽天シートに無い「ダクトレール取り付け」列を除いて渡す)
node tools/gas-rakuten/run-rakuten.mjs --gas "tmp/楽天(GAS)" --book "tmp/（楽天）商品情報更新データ作成.xlsx" \
  --out /tmp/rk_ledger \
  --pl-ledger tmp/ペンダントライト/ペンダントライト一覧_20260929.xlsm \
  --cf-ledger tmp/シーリングファン/シーリングファン一覧_20260930_バリエーションヘッダー修復済み.xlsb

# 2. product-db 側を同じ初期状態にする(楽天の管理データ・台帳の取込)
cd server
npx tsx src/scripts/import-rakuten-master.ts "../tmp/（楽天）商品情報更新データ作成.xlsx" --replace
npx tsx src/scripts/import-excel.ts "../tmp/ペンダントライト/ペンダントライト一覧_20260929.xlsm"
npx tsx src/scripts/import-excel.ts "../tmp/シーリングファン/シーリングファン一覧_20260930_バリエーションヘッダー修復済み.xlsb"

# 3. product-db から出力して比べる
npx tsx src/scripts/export-rakuten.ts --type rakuten_new_cf --out /tmp/rk_db
python3 ../tools/gas-rakuten/compare-rakuten.py /tmp/rk_ledger/cf_new.csv /tmp/rk_db/rakuten_new_cf.csv
```

GAS が変わったら `python3 tools/gas-rakuten/generate-ts.py "tmp/楽天(GAS)"` で定数・テンプレートを写し直し、ロジックの差分は `server/src/lib/rakuten/rakutenCsv.ts` に手で反映する。

## HtmlService の癖(実際の出力で確認)

- `?>` の直後の改行1つは出力しない(`<? ?>`・`<?= ?>` とも)
- 評価結果から HTML コメント(`<!-- -->`)を取り除く
