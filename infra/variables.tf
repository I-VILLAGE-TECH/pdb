variable "project_id" {
  description = "GCPプロジェクトID(report-app と同じプロジェクト)"
  type        = string
}

variable "region" {
  description = "リージョン"
  type        = string
  default     = "asia-northeast1"
}

variable "service_name" {
  description = "サービス名(Cloud Run / Artifact Registry / シークレット / SA の名前に使用)"
  type        = string
  default     = "product-db"
}

variable "image" {
  description = "デプロイするコンテナイメージ(deploy.sh が更新する。初回はプレースホルダで可)"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "import_job_memory" {
  description = "Excel取込ジョブのメモリ上限(ブックの解析で最大900MB程度を使う)"
  type        = string
  default     = "2Gi"
}

# ---------- Cloud SQL ----------
variable "db_tier" {
  description = "Cloud SQL のマシンタイプ"
  type        = string
  default     = "db-f1-micro"
}

variable "db_connection_limit" {
  description = "Prisma の接続プール上限(Cloud Run インスタンスごと)。db-f1-micro は同時接続数が少ないため小さめ"
  type        = number
  default     = 3
}

# ---------- アプリ ----------
variable "admin_password" {
  description = "初期管理者(seed で作成)のパスワード。deploy.sh がシード実行時に使う"
  type        = string
  sensitive   = true
}

variable "invoker_member" {
  description = "Cloud Run を呼び出せるメンバー。report-app と同じく allUsers(アプリのログインで保護)"
  type        = string
  default     = "allUsers"
}

# ---------- 独自ドメイン(任意) ----------
variable "custom_domain" {
  description = "アプリに割り当てる独自ドメイン(例: product.hvls.i-village.co.jp)。空なら設定しない"
  type        = string
  default     = ""
}

variable "dns_managed_zone" {
  description = "report-app が作成した Cloud DNS ゾーン名(custom_domain 設定時に使用)"
  type        = string
  default     = "iv-form-zone"
}
