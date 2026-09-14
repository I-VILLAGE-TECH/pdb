output "artifact_repo" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}"
}

output "cloud_run_url" {
  value = google_cloud_run_v2_service.app.uri
}

output "cloudsql_connection_name" {
  value = google_sql_database_instance.db.connection_name
}
