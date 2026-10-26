#!/usr/bin/env bash
# ビルド → (バックアップ) → DBマイグレーション/シード → 取込ジョブ・Cloud Run サービスへデプロイ
# 構成は report-app と同じ(同じGCPプロジェクト)。Cloud SQL は product-db 専用のインスタンス(product-db-db)。
# 前提: infra/ で terraform apply 済み、gcloud auth login 済み、cloud-sql-proxy インストール済み、server/ で npm install 済み
#
# 環境変数:
#   PROXY_PORT=5435   Cloud SQL Auth Proxy のローカルポート(既定 5435。5434 はローカルの Docker DB と report-app が使う)
#   SKIP_BACKUP=1     マイグレーション前のオンデマンドバックアップを省略する
set -euo pipefail

cd "$(dirname "$0")"

PROJECT_ID="${PROJECT_ID:-$(terraform -chdir=infra output -raw artifact_repo 2>/dev/null | cut -d/ -f2 || true)}"
if [[ -z "${PROJECT_ID}" ]]; then
  echo "ERROR: PROJECT_ID を特定できません。infra/ で terraform apply 済みか確認するか、PROJECT_ID=xxx ./deploy.sh で指定してください" >&2
  exit 1
fi

REGION="${REGION:-asia-northeast1}"
SERVICE_NAME="${SERVICE_NAME:-product-db}"
REPO="$(terraform -chdir=infra output -raw artifact_repo)"
CONN="$(terraform -chdir=infra output -raw sql_connection_name)"
INSTANCE="$(terraform -chdir=infra output -raw sql_instance)"
EXPECTED_DB="$(terraform -chdir=infra output -raw db_name)"
TAG="$(date +%Y%m%d-%H%M%S)"
IMAGE="${REPO}/${SERVICE_NAME}:${TAG}"

echo "==> 対象: project=${PROJECT_ID} / instance=${INSTANCE} / database=${EXPECTED_DB}"

echo "==> Cloud Build でイメージをビルド: ${IMAGE}"
gcloud builds submit --project "${PROJECT_ID}" --region "${REGION}" --tag "${IMAGE}" .

# ---- マイグレーション前の保険としてオンデマンドバックアップ ----
if [[ "${SKIP_BACKUP:-}" != "1" ]]; then
  echo "==> Cloud SQL のオンデマンドバックアップを作成(instance=${INSTANCE})"
  gcloud sql backups create --instance "${INSTANCE}" --project "${PROJECT_ID}" \
    --description "before product-db deploy ${TAG}"
fi

# ---- DBマイグレーション + シード ----
# コンテナ起動時には実行しない(コールドスタート短縮のため。report-app と同じ)
echo "==> DBマイグレーション(Cloud SQL Auth Proxy 経由)"
PROXY_PORT="${PROXY_PORT:-5435}"
# ポートが使用中だと、プロキシが起動に失敗しても接続確認が通ってしまい、
# 別の DB(ローカルの Docker 等)に対してマイグレーションを実行しかねない。先に止める
if nc -z 127.0.0.1 "${PROXY_PORT}" 2>/dev/null; then
  echo "ERROR: ポート ${PROXY_PORT} は既に使用中です。PROXY_PORT=xxxx ./deploy.sh で空いているポートを指定してください" >&2
  exit 1
fi
PROXY_LOG="$(mktemp -t cloud-sql-proxy)"
# ADC のクォータプロジェクトが別プロジェクトだと Cloud SQL Admin API の 403 になるため、本番プロジェクトに固定する
cloud-sql-proxy "${CONN}" --port "${PROXY_PORT}" --quota-project "${PROJECT_ID}" >"${PROXY_LOG}" 2>&1 &
PROXY_PID=$!
trap 'code=$?; kill "${PROXY_PID}" 2>/dev/null || true; if [[ ${code} -ne 0 ]]; then echo "--- cloud-sql-proxy log ---" >&2; cat "${PROXY_LOG}" >&2; fi' EXIT

for i in $(seq 1 20); do
  kill -0 "${PROXY_PID}" 2>/dev/null || { echo "ERROR: Cloud SQL Auth Proxy が終了しました" >&2; exit 1; }
  if nc -z 127.0.0.1 "${PROXY_PORT}" 2>/dev/null; then break; fi
  [[ $i -eq 20 ]] && { echo "ERROR: Cloud SQL Auth Proxy が起動しません" >&2; exit 1; }
  sleep 0.5
done

# Secret Manager の接続URL(unixソケット形式)をプロキシ経由のTCP形式に変換
# (クエリの host= を外し、connection_limit などの他のパラメータは残す)
DATABASE_URL="$(gcloud secrets versions access latest --secret="${SERVICE_NAME}-database-url" --project "${PROJECT_ID}" \
  | sed -E "s#@localhost/#@127.0.0.1:${PROXY_PORT}/#; s#([?&])host=[^&]*&?#\1#; s#[?&]\$##")"

# 接続先DB名を URL から取り出し、想定どおりか確認する(シークレットの取り違え防止)
URL_DB="$(printf '%s' "${DATABASE_URL}" | sed -E 's#^[^/]*//[^/]*/([^?]*).*#\1#')"
if [[ "${URL_DB}" != "${EXPECTED_DB}" ]]; then
  echo "ERROR: 接続URLのDB名(${URL_DB})が想定(${EXPECTED_DB})と違います。中止します" >&2
  exit 1
fi

ADMIN_INITIAL_PASSWORD="$(gcloud secrets versions access latest --secret="${SERVICE_NAME}-admin-password" --project "${PROJECT_ID}")"

(
  cd server
  export DATABASE_URL ADMIN_INITIAL_PASSWORD
  npx prisma migrate deploy
  npm run db:seed              # 連携先の初期データ・初期管理者(既存は上書きしない)
  npm run db:seed-fs           # futureshop 商品CSVの列定義(何度でも実行可)
  npm run db:seed-maker-names  # メーカーマスタの初期値(未設定分のみ。画面で変更した値は上書きしない)
)

kill "${PROXY_PID}" 2>/dev/null || true
trap - EXIT

# Excel取込ジョブ(Cloud Run ジョブ)も同じイメージに揃える(サービスより先に更新し、新しいサービスが古いジョブを起動しないようにする)
echo "==> Excel取込ジョブを更新: ${SERVICE_NAME}-import"
gcloud run jobs update "${SERVICE_NAME}-import" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE}" \
  --quiet

echo "==> Cloud Run へデプロイ"
gcloud run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE}" \
  --quiet

URL="$(gcloud run services describe "${SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)')"
echo "==> デプロイ完了: ${URL}"
