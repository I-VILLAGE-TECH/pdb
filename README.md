# product-db — 商品管理システム

ペンダントライト・シーリングファンの2つのExcelブックで管理していた商品データを、
**1つの基幹DB（PostgreSQL）＋ Web管理ツール（SPA）** で一元管理するシステム。

設計書: [documents/03_設計](../documents/03_設計/README.md)（D1-1 システム概要 / D1-3 DB設計 / D1-4 連携同期共通設計）

## 構成

```
product-db/
├── server/          # API（Node.js + Express + Prisma）本番はビルド済みSPAも配信
│   ├── prisma/      #   スキーマ・マイグレーション・seed（channels初期データ）
│   └── src/
│       ├── routes/  #   products / makers / channels / categories / sync / dashboard
│       └── scripts/ #   import.ts（初期移行ローダ）
├── web/             # SPA（Vite + React + TypeScript）
├── tools/import/    # 初期移行: Excel 2ブック → JSON 抽出（Python）
├── infra/           # GCP（Terraform: Cloud Run + Cloud SQL + Artifact Registry）
├── Dockerfile       # マルチステージ（web build + server build → 1イメージ）
├── docker-compose.yml  # ローカル: PostgreSQL + アプリ
└── deploy.sh        # Cloud Build → Cloud Run デプロイ
```

## DB設計の要点（D1-3 準拠）

| テーブル | 役割 |
|---|---|
| `makers` | メーカーマスタ（コード・和英名・画像フォルダ） |
| `products` | 商品マスタ（PL/CF共通属性。単品/親バリエーション/セット/構成部材を`product_kind`で区別） |
| `product_lighting_attrs` | 照明系拡張（1:1。電球・調光・取付・畳数…） |
| `product_fan_attrs` | ファン系拡張（1:1。AC/DC・羽枚数・風量・リズム…） |
| `product_variations` | SKU（`型番+vN`を構造化。**単品も v1 を1行持つ**。在庫実数を保持） |
| `product_images` | 画像（M/I/S/F/R/E/L/バナー/AD を縦持ち・枚数制限なし） |
| `set_components` | セット構成明細（セット親 ↔ 構成部材の多対多。型番8枠の役割をenum化） |
| `categories` / `product_categories` | 内部カテゴリ（階層） |
| `channels` | 連携先マスタ（送信方式・文字コード・在庫連携方式・分割件数…） |
| `channel_field_maps` | 連携先ごとの出力列マッピング（VBAのSelect Caseのデータ化） |
| `channel_category_maps` | 内部カテゴリ→連携先カテゴリ対応 |
| `product_channel_prices` | 販路別価格（CFの販売価格2=Amazon 等） |
| `product_channel_links` | **SKU×連携先の同期状態**（local/sent/remote 3層スナップショット＋diff_status） |
| `sync_jobs` / `sync_job_items` | 反映履歴（n/u/d・結果） |
| `users` / `sessions` | 認証・ユーザー管理（ADMIN/EDITOR、DBセッション） |
| `master_items` | 汎用コードマスタ（仕入先・取付タイプ・口金・電球色・光色・本体カラー・素材・保証期間・AC/DC）。既存データから `npm run db:extract-masters` で抽出投入 |

## 認証・ユーザー管理

- Cookieセッション（httpOnly / SameSite=Lax / 7日）＋ bcrypt。`/api/auth/*` 以外の全APIは要ログイン
- 権限: **ADMIN**（ユーザー管理含む全操作）/ **EDITOR**（商品・在庫・価格の編集と反映）
- 初期管理者は seed で作成: `admin@example.com` / `admin1234`
  （`ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` 環境変数で上書き可。**初回ログイン後に必ず変更**）
- ユーザーは削除せず**無効化**（履歴保全。無効化時に既存セッションも破棄）。自分自身の権限変更・無効化は不可

## ローカル環境構築・実行方法

### 前提

| ツール | バージョン | 用途 |
|---|---|---|
| Docker Desktop | 最新 | PostgreSQL（＋方法1ではアプリも） |
| Node.js | 22 以上（npm 同梱） | server / web の開発実行 |
| Python 3 + openpyxl + pyxlsb | 任意 | 初期移行CLI（`tools/import`）を使う場合のみ |

ポートは **5434**（PostgreSQL）/ **8081**（方法1のアプリ）/ **8080**（方法2のAPI）/ **5173**（方法2のSPA）を使用。
他プロセスと衝突する場合は `docker-compose.yml` や `server/.env` の該当箇所を変更する。

### 方法1: 全部Dockerで動かす（動作確認向け）

```bash
docker compose up --build   # 初回はビルドに数分
# → http://localhost:8081
```

- 起動時にマイグレーション適用（`prisma migrate deploy`）と seed（channels初期データ・初期管理者）まで自動実行される
- ログイン: `admin@example.com` / `admin1234`（seedの初期管理者。初回ログイン後に必ず変更）
- DBデータ・アップロード画像は名前付きボリューム（`product-db-pgdata` / `product-db-uploads`）に永続化される

```bash
docker compose down       # 停止（データは残る）
docker compose down -v    # 停止＋データも全削除（DBを作り直したいとき）
```

### 方法1b: Docker開発モード（再ビルド不要でコード変更を反映）

```bash
docker compose --profile dev up -d app-dev
# → http://localhost:8082
```

- ソースをマウントし、コンテナ内で server=tsx watch / web=Vite(HMR) を実行。**コードを保存すると即反映**（再ビルド不要）
- 初回のみ依存インストールで数分。node_modules はコンテナ専用ボリュームに分離（ホストと混ざらない）
- DB・アップロード画像は方法1と同じボリュームを共有。方法1の `app`（:8081、本番同等ビルド）とは併用可
- 停止: `docker compose --profile dev stop app-dev`

### 方法2: 開発モード（DBだけDocker、アプリはホットリロード）

```bash
# 1) DBだけ起動（localhost:5434）
docker compose up -d db

# 2) APIサーバ（http://localhost:8080）
cd server
cp .env.example .env      # DATABASE_URL（compose の db に接続）と PORT。初回のみ
npm install
npx prisma migrate dev    # マイグレーション適用（Prisma Client生成込み）
npm run db:seed           # channels初期データ・初期管理者の投入
npm run dev               # tsx watch で起動（ホットリロード）

# 3) SPA（別ターミナルで。http://localhost:5173）
cd web
npm install
npm run dev               # /api・/uploads は :8080 へプロキシ（vite.config.ts）
```

ブラウザでは **http://localhost:5173** を開く（APIの向き先を変えたい場合は `API_URL` 環境変数でプロキシ先を上書き可）。

### よく使うコマンド（server/）

| コマンド | 内容 |
|---|---|
| `npm run db:migrate` | スキーマ変更のマイグレーション作成・適用（開発用） |
| `npm run db:seed` | seed再投入（upsertなので再実行可） |
| `npm run db:import` | 初期移行: `tools/import/out/` のJSONをDBへ取込（後述） |
| `npm run db:extract-masters` | 既存データから汎用コードマスタ（master_items）を抽出投入 |
| `npx prisma studio` | DBの中身をブラウザで確認 |

### うまく動かないとき

- **ポート衝突**（5434/8081/8080/5173）: 使用中のプロセスを止めるか、`docker-compose.yml` / `server/.env` / `web/vite.config.ts` のポートを変更
- **DBを最初からやり直したい**: `docker compose down -v` → 方法1ならそのまま `up --build`、方法2なら `up -d db` から手順をやり直す
- **`prisma migrate dev` が失敗する**: `docker compose ps` で db が healthy か確認。`server/.env` の `DATABASE_URL`（ポート5434）も確認

## Excel取込（Web画面から・ADMINのみ）

サイドメニュー「商品管理 > Excel取込」から現行ブック（.xlsm / .xlsb）をアップロードして取り込めます。
ブック種別はシート名（ペンダントライト一覧 / シーリングファンデータ）から自動判定。

- **差分更新**（既定）: 商品コードでupsert。ファイルに無い既存商品はそのまま
- **全入れ替え**: 取込後、同一種別でファイルに無い既存商品を**論理削除**（deleted_at。物理削除しない）。
  再度ファイルに現れた商品は論理削除が自動解除される
- バックグラウンドジョブ＋進捗表示。解析は `server/src/lib/excelExtract.ts`（tools/import/extract.py と同一マッピングのTS移植）
- 注意: ジョブ状態はプロセス内メモリ管理のため、Cloud Runで複数インスタンス構成にする場合はジョブテーブル化が必要

## 初期移行（Excel 2ブック → DB・CLI版）

```bash
# 1. Excel → JSON（要 python3 + openpyxl + pyxlsb）
cd tools/import
python3 extract.py \
  --pl "path/to/ペンダントライト一覧_XXXX.xlsm" \
  --cf "path/to/シーリングファン一覧XXXX.xlsb"
# → out/pl_products.json / cf_products.json / makers.json

# 2. JSON → DB（upsert なので再実行可）
cd ../../server
npm run db:import
```

取り込み内容: メーカー / 商品（共通属性）/ 照明・ファン拡張属性 / バリエーション（SKU）/
画像 / セット構成（型番→商品の引当込み）/ 販路別価格（Amazon）。
未マッピング列は `products.extra`（jsonb）に退避。

## 本番（GCP）

Cloud Run（1サービス: API + SPA配信）+ Cloud SQL（PostgreSQL 16）+ Artifact Registry。
DATABASE_URL は Secret Manager 経由で注入、Cloud SQL へは unix ソケット接続。

```bash
# 初回のみ: インフラ構築
cd infra
cp terraform.tfvars.example terraform.tfvars   # project_id 等を記入
terraform init && terraform apply

# デプロイ（ビルド → プッシュ → Cloud Run）
./deploy.sh
```

マイグレーションはコンテナ起動時に `prisma migrate deploy` で自動適用。
Cloud Run は既定で IAM 認証（`invoker_member`）。全公開する場合はアプリ側に認証を実装のうえ `allUsers` に変更する。

## API 概要

| メソッド | パス | 内容 |
|---|---|---|
| POST | `/api/auth/login` / `/api/auth/logout` | ログイン・ログアウト（Cookieセッション） |
| GET / PUT | `/api/auth/me` / `/api/auth/password` | 自分の情報・パスワード変更 |
| GET/POST/PUT | `/api/users`, `/api/users/:id` | ユーザー管理（ADMINのみ。無効化・権限変更） |
| POST | `/api/users/:id/reset-password` | パスワード再設定（ADMINのみ） |
| GET | `/api/products` | 一覧（q/category/status/makerId/更新日時/ページング） |
| GET | `/api/products/export` | 汎用（マスタ形式）CSV。UTF-8(BOM)・商品単位・一覧と同じフィルタ |
| GET/POST | `/api/exports/preview` / `/api/exports/csv` | **プラットフォーム別CSV**。`channel_field_maps` の列定義でSKU単位に生成。文字コード（Shift_JIS/UTF-8）・在庫方式（数量/あり・なし）・価格採用列は `channels` 設定に従う。POSTは `productCodes` 配列で対象を限定可（★マーク付きのみ出力。マークはブラウザのローカルストレージにユーザーIDごとに保存され、他ユーザーに影響しない） |
| POST | `/api/products/bulk` | **一括保存（シート編集UI用）**。idありは更新・なしは新規、行ごとに結果返却 |
| GET/POST/PUT/DELETE | `/api/products/:id` | 詳細・登録（代表SKU自動作成）・更新・論理削除 |
| POST/PUT/DELETE | `/api/products/:id/variations/…` | SKU追加・更新・削除 |
| PATCH | `/api/products/:id/variations/:vid/stock` | 在庫のみ更新（UC③） |
| POST/DELETE | `/api/products/:id/images(/:imageId)` | 商品画像のアップロード・削除。保存先はローカル`uploads/`（Docker volume）またはGCS（`GCS_BUCKET`設定時）、配信は認証つき `GET /uploads/<key>` |
| GET/POST/PUT | `/api/makers`, `/api/channels`, `/api/categories` | 各マスタ |
| POST | `/api/sync/recalculate` | 差分再計算（local層のハッシュ更新＋diff_status確定） |
| GET | `/api/sync/links` | 連携状況一覧（SKU×連携先） |
| POST | `/api/sync/reflect` | 反映（手動・選択分のみ。ジョブ作成→sent更新） |
| GET | `/api/sync/jobs` | 反映履歴 |
| GET | `/api/dashboard` | 集計 |

## 未実装（設計書の次フェーズ）

- 連携アダプタ実装（futureshop CSV+FTP / 在庫API、Yahoo・楽天・Amazon・NE）。
  `POST /api/sync/reflect` に `send/awaitResult/fetchRemote` を差し込む構造は用意済み
- `channel_field_maps` の本仕様化。現在は各モールたたき台の列定義（6〜12列）をseed済みで、
  CSV出力画面から利用可。個別設計（D2-x）確定時に本仕様（FS111列等）へ差し替える。
  `source_expr` の `func:` 変換関数は `server/src/routes/exports.ts` に追加していく
- CSV分割出力（futureshopの700行分割。現在は分割目安の警告表示のみ）
- remote層（連携先現在値）の取得と drift 判定
- 反映操作の通知（Slack/メール）
