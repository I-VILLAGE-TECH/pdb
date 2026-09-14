terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ---------- APIの有効化 ----------
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudbuild.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}

# ---------- Artifact Registry ----------
resource "google_artifact_registry_repository" "app" {
  repository_id = "${var.service_name}-repo"
  location      = var.region
  format        = "DOCKER"
  depends_on    = [google_project_service.apis]
}

# ---------- GCS（商品画像ストレージ） ----------
resource "google_storage_bucket" "images" {
  name                        = "${var.project_id}-${var.service_name}-images"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced" # 配信はアプリ経由（認証つき）
  depends_on                  = [google_project_service.apis]
}

resource "google_storage_bucket_iam_member" "images" {
  bucket = google_storage_bucket.images.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.run.email}"
}

# ---------- Cloud SQL (PostgreSQL 16) ----------
resource "google_sql_database_instance" "db" {
  name             = "${var.service_name}-db"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier = var.db_tier
    ip_configuration {
      ipv4_enabled = true # 接続はCloud SQLコネクタ(unixソケット)経由
    }
    backup_configuration {
      enabled    = true
      start_time = "18:00" # JST 03:00
    }
  }
  deletion_protection = true
  depends_on          = [google_project_service.apis]
}

resource "google_sql_database" "app" {
  name     = var.service_name
  instance = google_sql_database_instance.db.name
}

resource "random_password" "db" {
  length  = 24
  special = false
}

resource "google_sql_user" "app" {
  name     = var.service_name
  instance = google_sql_database_instance.db.name
  password = random_password.db.result
}

# ---------- シークレット ----------
locals {
  database_url = "postgresql://${google_sql_user.app.name}:${random_password.db.result}@localhost/${google_sql_database.app.name}?host=/cloudsql/${google_sql_database_instance.db.connection_name}"
  secrets = {
    "database-url" = local.database_url
  }
}

resource "google_secret_manager_secret" "app" {
  for_each  = local.secrets
  secret_id = "${var.service_name}-${each.key}"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "app" {
  for_each    = local.secrets
  secret      = google_secret_manager_secret.app[each.key].id
  secret_data = each.value
}

# ---------- サービスアカウント ----------
resource "google_service_account" "run" {
  account_id   = "${var.service_name}-run"
  display_name = "Cloud Run service account for ${var.service_name}"
}

resource "google_project_iam_member" "cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.run.email}"
}

resource "google_secret_manager_secret_iam_member" "run" {
  for_each  = google_secret_manager_secret.app
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}

# ---------- Cloud Run ----------
resource "google_cloud_run_v2_service" "app" {
  name                = var.service_name
  location            = var.region
  deletion_protection = false

  template {
    service_account = google_service_account.run.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.db.connection_name]
      }
    }

    containers {
      image = var.image

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      env {
        name  = "COOKIE_SECURE"
        value = "true"
      }
      env {
        name  = "GCS_BUCKET"
        value = google_storage_bucket.images.name
      }
      dynamic "env" {
        for_each = {
          DATABASE_URL = "database-url"
        }
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.app[env.value].secret_id
              version = "latest"
            }
          }
        }
      }

      startup_probe {
        http_get {
          path = "/healthz"
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 12
      }
    }
  }

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_version.app,
    google_secret_manager_secret_iam_member.run,
  ]

  lifecycle {
    ignore_changes = [client, client_version]
  }
}

# 社内ツールのため、まずは認証必須（IAM）で公開しない。
# 全公開する場合は member = "allUsers" に変更し、アプリ側に認証を実装すること。
resource "google_cloud_run_v2_service_iam_member" "invoker" {
  name     = google_cloud_run_v2_service.app.name
  location = var.region
  role     = "roles/run.invoker"
  member   = var.invoker_member
}
