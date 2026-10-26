# GCP へのデプロイ手順

構成は report-app(報告フォーム `iv-form`)と同じ: **Cloud Run + Cloud SQL(PostgreSQL 16) + GCS + Secret Manager + Artifact Registry**。
GCP プロジェクトは report-app と同じ `iv-product-db` だが、**Cloud SQL インスタンスは product-db 専用**に持つ。
設計(構成図・処理の実行方式・費用)は [documents/03_設計/01_全体/06_連携エンジン・インフラ設計.md](../documents/03_設計/01_全体/06_連携エンジン・インフラ設計.md)。

- 画面・API: Cloud Run サービス `product-db`(512MiB、CPU・メモリはリクエスト処理中のみ課金)。CSV 出力もリクエストの中で生成して返す
- Excel 取込: Cloud Run ジョブ `product-db-import`(2GiB、実行中のみ課金)。サービスがブックを GCS に置いて起動する

| リソース | product-db | report-app(参考) |
| --- | --- | --- |
| Cloud SQL インスタンス | `product-db-db`(専用) | `iv-form-db` |
| データベース / DBユーザー | `product-db` / `product-db` | `iv-form` / `iv-form` |
| Cloud Run | サービス `product-db` / ジョブ `product-db-import` | `iv-form` |
| Artifact Registry | `product-db-repo` | `iv-form-repo` |
| GCS | `iv-product-db-product-db-images` | `iv-product-db-iv-form-photos` |
| シークレット | `product-db-database-url` / `product-db-admin-password` | `iv-form-*` |
| DNS ゾーン | `iv-form-zone`(hvls.i-village.co.jp)にレコードを追加するだけ(任意) | ゾーンを管理 |

## 同じプロジェクトの report-app に影響を与えないためのルール

1. **report-app/infra では `terraform` を実行しない。** product-db の作業は `product-db/infra` だけで行う。
2. API の有効化・Cloud Build の権限・DNS ゾーンは report-app の infra が管理している。product-db の Terraform では作らない
   (`google_project_iam_member` などを重複して持つと、destroy 時に report-app の設定まで消えるため)。
3. `terraform apply` の前に必ず `terraform plan` を見て、作成・変更されるリソースの名前がすべて `product-db` で始まること、
   `iv-form` を含むリソースが出てこないことを確認する(初回は追加(+)のみ)。
4. 本番DBに手でコマンドを実行するときは、接続先が `product-db-db` / `product-db` であることを確認する。
   `prisma migrate reset` / `prisma db push --accept-data-loss` は本番では使わない。
5. `deploy.sh` は、接続URLのDB名が Terraform の出力と一致することと、Cloud SQL Auth Proxy のポートが空いていることを確認してから実行する。
   マイグレーション前にオンデマンドバックアップを作る(`SKIP_BACKUP=1` で省略可)。

## 事前準備(初回のみ)

```bash
gcloud auth login
gcloud auth application-default login   # Terraform が使う
brew install cloud-sql-proxy
cd product-db/server && npm install      # deploy.sh がマイグレーション・シードに使う
```

ローカルの gcloud の既定プロジェクトが別のことがあるので、コマンドには必ず `--project iv-product-db` を付ける(deploy.sh は自動で付ける)。

## 1. インフラ構築(初回のみ)

```bash
cd product-db/infra
cp terraform.tfvars.example terraform.tfvars   # admin_password を記入
terraform init
terraform plan    # ← ルール3: 追加(+)のみで、名前がすべて product-db で始まることを確認
terraform apply
```

作られるもの: Cloud SQL インスタンス(`product-db-db`。作成に10分前後かかる)・DB・ユーザー、シークレット2件、サービスアカウント、GCSバケット、Artifact Registry、Cloud Run サービスと取込ジョブ(プレースホルダのイメージ)、取込ジョブの起動権限。
API の有効化と Cloud Build の権限は report-app の構築時に設定済みのため、ここでは作らない。
Cloud SQL インスタンス(db-f1-micro)の分、月額の費用が増える。

## 2. デプロイ(毎回)

```bash
cd product-db
./deploy.sh
```

ビルド → バックアップ → マイグレーション・シード(Cloud SQL Auth Proxy 経由、ポート 5435) → 取込ジョブのイメージ更新 → Cloud Run サービスへデプロイ、まで自動で行う。
シードは `db:seed`(連携先・初期管理者。既存は上書きしない)、`db:seed-fs`(futureshop 列定義)、`db:seed-maker-names`(メーカーマスタの初期値。未設定のメーカー・項目にだけ入れ、画面で変更した値は上書きしない)。

初回ログイン: `admin@example.com` / `terraform.tfvars` の `admin_password`。ログイン後に変更する。

## 3. 商品データの投入(初回・Excel 更新時)

- **Excel 取込**: 画面の「Excel取込」(ADMIN)からブックをアップロード。取込ジョブの起動に十数秒〜数十秒かかり、その間は「起動待ち」と表示される。
  取込中は次の取込を受け付けない。ジョブのログは Cloud Run の「ジョブ」→ `product-db-import` → 実行履歴で確認できる
- **元画像**: 画面の「画像(アップロード・出力)」(ADMIN)で、現行の画像フォルダ(`img\cf_item_img`・`img\pl_item_img`)をフォルダごとアップロードする。
  未登録・変更分だけが送られ、幅・高さも計測して `image_files` に入る(下の画像サイズのスクリプトは、元画像が未アップロードの画像サイズを補う用途)
- **取込項目を追加したリリースの後**: 両ブックを Excel取込し直す(例: 2026-10-26 の HTML 出力・画像出力で `extra.specRows`・`specCells`・`plRowImages` を追加)
- **画像サイズ(CF 独自コメント用)**: 本番DBに対してスクリプトを実行する

```bash
cd product-db
CONN=$(terraform -chdir=infra output -raw sql_connection_name)
# 別ターミナル: cloud-sql-proxy "$CONN" --port 5435 --quota-project iv-product-db
cd server
DATABASE_URL=$(gcloud secrets versions access latest --secret=product-db-database-url --project iv-product-db \
  | sed -E 's#@localhost/#@127.0.0.1:5435/#; s#([?&])host=[^&]*&?#\1#; s#[?&]$##')
echo "$DATABASE_URL" | grep -q '/product-db?' || { echo "接続先DBが product-db ではありません"; exit 1; }   # ルール4
DATABASE_URL="$DATABASE_URL" npx tsx src/scripts/seed-image-files.ts "<CFブック.xlsb>"
```

## 4. 独自ドメイン(任意)

report-app のゾーン(hvls.i-village.co.jp、NS委任済み)の配下にホスト名を追加する。

```bash
# infra/terraform.tfvars に追記
custom_domain = "pdb.hvls.i-village.co.jp"
```

`terraform plan`(ルール3) → `terraform apply`。Cloud Run のドメインマッピングと CNAME が作られる(証明書発行に十数分〜)。
共有ゾーンはレコードを追加するだけで、ゾーン自体は変更しない。
ドメインマッピングは、Terraform を実行するアカウントが Search Console でドメイン(または親ドメイン)の所有者として確認済みでないと失敗する。

## ロールバック

- アプリ: Cloud Run のリビジョンを以前のものに戻す(`gcloud run services update-traffic product-db --to-revisions=<rev>=100 --project iv-product-db --region asia-northeast1`)
- DB: deploy.sh が作ったバックアップ、または毎日の自動バックアップ(JST 03:00)から `product-db-db` を復元する(専用インスタンスなので report-app には影響しない)

## 取込ジョブのトラブル対応

| 症状 | 確認・対処 |
| --- | --- |
| 「起動待ち」のまま進まない | Cloud Run の ジョブ `product-db-import` に実行履歴があるか確認。無ければサービスのログで「取込ジョブの起動に失敗しました」を確認(権限・ジョブ名) |
| 「エラー: 時間切れ」になった | ジョブがエラーを記録できずに終了した(メモリ超過・タイムアウト等)。ジョブの実行ログを確認し、必要なら `import_job_memory`(既定 2Gi)を増やして `terraform apply` |
| 「取込が実行中です」で始められない | 実行中の取込の完了を待つ。異常終了した取込は40分で自動的にエラー扱いになる |
