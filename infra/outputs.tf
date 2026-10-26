output "artifact_repo" {
  description = "コンテナイメージのリポジトリ"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}"
}

output "service_url" {
  description = "Cloud Run の URL"
  value       = google_cloud_run_v2_service.app.uri
}

output "sql_connection_name" {
  description = "Cloud SQL の接続名"
  value       = google_sql_database_instance.db.connection_name
}

output "sql_instance" {
  description = "Cloud SQL のインスタンス名"
  value       = google_sql_database_instance.db.name
}

output "db_name" {
  description = "product-db の論理データベース名"
  value       = google_sql_database.app.name
}

output "images_bucket" {
  description = "商品画像用 GCS バケット"
  value       = google_storage_bucket.images.name
}

output "custom_url" {
  description = "独自ドメインの URL(custom_domain 設定時)"
  value       = local.use_custom_domain ? "https://${var.custom_domain}" : null
}
