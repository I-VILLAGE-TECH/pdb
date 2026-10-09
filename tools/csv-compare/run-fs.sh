#!/bin/bash
# futureshop 向けCSV全種の並行出力比較をまとめて実行する。
# 事前に server/src/scripts/import-excel.ts で両ブックを取り込んでおくこと。
#   usage: tools/csv-compare/run-fs.sh [正解CSVのディレクトリ(既定: product-db/tmp)] [出力先(既定: /tmp/fs-compare)]
# 正解ディレクトリは「ペンダントライト/」「シーリングファン/」の下に現行マクロのボタン別フォルダがある構成
set -u
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
EXP=${1:-$ROOT/tmp}
OUT=${2:-/tmp/fs-compare}
mkdir -p "$OUT"
PL="$EXP/ペンダントライト"
CF="$EXP/シーリングファン"

# 種別 ブック 正解glob
CASES=(
  "products PL|$PL/01_FS_ccGoods商品CSV/*.csv"
  "products PL|$PL/10_FS_ccGoods商品CSV（その他）/*.csv"
  "variation_choice_new PL|$PL/03_FS_goodsVariationNewItem/PL_FSバリエーション選択肢登録_new_*1438_*.csv"
  "variation_choice_update PL|$PL/04_FS_goodsVariationUpdate/PL_FSバリエーション選択肢登録_update_*.csv"
  "variation_detail PL|$PL/04_FS_goodsVariationUpdate/PL_FSバリエーション詳細登録_*.csv"
  "variation_stock PL|$PL/04_FS_goodsVariationUpdate/PL_FSバリエーション在庫_*.csv"
  "variation_price PL|$PL/04_FS_goodsVariationUpdate/PL_FSバリエーション価格_*.csv"
  "category PL|$PL/05_FS_Categoryグループ/*.csv"
  "category PL|$PL/12_FS_Categoryグループ（その他）/*.csv"
  "products CF|$CF/01_FS_ccGoods商品CSV/*.csv"
  "comment16 CF|$CF/11_独自コメント16/*.csv"
  "category CF|$CF/03_FS_Categoryグループ/*.csv"
  "option_basic CF|$CF/04_FS_goodsOptionPriceオプション/FSオプション基本*.csv"
  "option_select CF|$CF/04_FS_goodsOptionPriceオプション/FSオプション選択肢*.csv"
  "tag CF|$CF/05_FS_Goodsタグ商品/*.csv"
  "variation_choice_new CF|$CF/07_FS_goodsVariationNewItem/FSバリエーション選択肢登録*.csv"
  "variation_choice_update CF|$CF/08_FS_goodsVariationUpdate/FSバリエーション選択肢登録*.csv"
  "variation_detail CF|$CF/07_FS_goodsVariationNewItem/FSバリエーション詳細登録*.csv"
  "variation_stock CF|$CF/07_FS_goodsVariationNewItem/FSバリエーション在庫*.csv"
  "image_alt CF|$CF/13_FS_ccGoodsImage画像ALT/*.csv"
)

cd "$ROOT/server"
DONE="|"  # 出力済みの種別(macOS標準のbash3.2は連想配列が無いので文字列で持つ)
for c in "${CASES[@]}"; do
  spec=${c%%|*}; glob=${c#*|}
  read -r type book <<<"$spec"
  actual="$OUT/${book}_${type}.csv"
  if [[ "$DONE" != *"|$spec|"* ]]; then
    npx tsx src/scripts/export-csv.ts --type "$type" --book "$book" --out "$actual" >/dev/null 2>&1 || { echo "!! 出力失敗: $spec"; continue; }
    DONE="$DONE$spec|"
  fi
  echo "=== $spec  <- ${glob#$EXP/}"
  python3 "$ROOT/tools/csv-compare/compare.py" --expected "$glob" --actual "$actual" --examples 2 \
    | grep -E "^(keys|cells|キー内|!!|  \[)"
done
