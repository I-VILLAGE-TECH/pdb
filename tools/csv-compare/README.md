# csv-compare

現行Excel(VBA)が出力したCSVと product-db が出力したCSVをセル単位で比較する(並行出力比較)。
手順全体は `documents/02_検討事項/01_全体/05_並行出力比較_テスト手順.md`。

## 流れ

```sh
cd product-db/server

# 1. 元のExcelブックをDBへ取り込む(Web画面のインポートと同じ処理。--replace でブック内に無い商品を論理削除)
npx tsx src/scripts/import-excel.ts "../tmp/ペンダントライト/ペンダントライト一覧_20260929.xlsm" --replace

# 2. product-db 側のCSVを出力(エクスポート画面と同じ生成処理。分割なしの1ファイル)
#    --type: products / category / variation_detail ... (routes/exports.ts の fileType)
#    --book: PL(「XX-9999」形式の商品コード) / CF(シーリングファン一覧)
npx tsx src/scripts/export-csv.ts --type products --book PL --out /tmp/PL_products.csv

# 3. 比較(正解側は分割ファイルをglobでまとめて指定)
python3 ../tools/csv-compare/compare.py \
  --expected '../tmp/ペンダントライト/01_FS_ccGoods商品CSV/*.csv' \
  --actual /tmp/PL_products.csv --examples 3
```

## compare.py の動き

- 分割ファイル(`_1.._N`)は連結して1つの表として扱う(各ファイルのヘッダー行は先頭のみ採用)
- 行はキー列(既定: `商品URLコード`、`--key` で変更)でまとめ、同じキーの中は出現順で突き合わせる。
  行順に意味が無いCSVは `--sort-within-key` でキー内を並べ替えてから比較
- 列はヘッダー名で対応づける(列順の違いは差分にしない。ヘッダーの不一致は先頭に表示)
- 文字コードは cp932。現行CSVの不正バイトは置換文字にして件数を表示
- 出力: キーの片側のみ件数、キー内の行数不一致、セル一致率、列ごとの差分件数と例(長いセルは最初に食い違う位置の前後)。
  `--json` で全差分を保存
- macOS のファイル名(NFD)でも glob が当たるようにしてある
