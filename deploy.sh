#!/usr/bin/env bash
# ビルド → Artifact Registryへプッシュ → Cloud Runへデプロイ
# 前提: infra/ で terraform apply 済み、gcloud auth login 済み
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
TAG="$(date +%Y%m%d-%H%M%S)"
IMAGE="${REPO}/${SERVICE_NAME}:${TAG}"

echo "==> Cloud Build でイメージをビルド: ${IMAGE}"
gcloud builds submit --project "${PROJECT_ID}" --region "${REGION}" --tag "${IMAGE}" .

echo "==> Cloud Run へデプロイ"
gcloud run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE}" \
  --quiet

URL="$(gcloud run services describe "${SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)')"
echo "==> デプロイ完了: ${URL}"
