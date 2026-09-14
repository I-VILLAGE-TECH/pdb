variable "project_id" {
  description = "GCPプロジェクトID"
  type        = string
}

variable "region" {
  description = "リージョン"
  type        = string
  default     = "asia-northeast1"
}

variable "service_name" {
  description = "サービス名（Cloud Run / Cloud SQL / Artifact Registry の名前に使用）"
  type        = string
  default     = "product-db"
}

variable "db_tier" {
  description = "Cloud SQL のマシンタイプ"
  type        = string
  default     = "db-f1-micro"
}

variable "image" {
  description = "デプロイするコンテナイメージ（初回は gcr.io/cloudrun/hello でも可）"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "invoker_member" {
  description = "Cloud Run を呼び出せるメンバー（例: user:foo@example.com / allUsers）"
  type        = string
}
