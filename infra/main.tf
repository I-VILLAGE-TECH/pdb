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

# 構成は report-app(iv-form)と同じ: Cloud Run + Cloud SQL(PostgreSQL) + GCS + Secret Manager。
# GCP プロジェクトは report-app と同じだが、Cloud SQL インスタンスは product-db 専用に持つ。
#
# ■ 同じプロジェクトの report-app に影響を与えないための約束
# - API の有効化、Cloud Build の権限、DNSゾーンは report-app の infra が管理している。ここでは作らない
#   (google_project_iam_member 等は destroy 時に共有の設定まで消すため、重複して持たない)
# - このstateが作るのは product-db 専用のものだけ(名前はすべて service_name = product-db で始まる)
# - report-app/infra では terraform を実行しない

# ---------- Cloud SQL (PostgreSQL 16・product-db 専用) ----------
resource "google_sql_database_instance" "db" {
  name             = "${var.service_name}-db"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier    = var.db_tier
    edition = "ENTERPRISE" # 共有コアtier(db-f1-micro)はENTERPRISEのみ。省略するとENTERPRISE_PLUSと解釈されエラーになる
    ip_configuration {
      ipv4_enabled = true # 接続はCloud SQLコネクタ(unixソケット)経由
    }
    backup_configuration {
      enabled    = true
      start_time = "18:00" # JST 03:00
    }
  }
  deletion_protection = true
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

# ---------- Artifact Registry ----------
resource "google_artifact_registry_repository" "app" {
  repository_id = "${var.service_name}-repo"
  location      = var.region
  format        = "DOCKER"
}

# ---------- GCS(商品画像ストレージ) ----------
resource "google_storage_bucket" "images" {
  name                        = "${var.project_id}-${var.service_name}-images"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced" # 配信はアプリ経由(認証つき)
}

# ---------- シークレット ----------
locals {
  # db-f1-micro は同時接続数が少ないため、Prisma の接続プールを小さくする
  database_url = "postgresql://${google_sql_user.app.name}:${random_password.db.result}@localhost/${google_sql_database.app.name}?host=/cloudsql/${google_sql_database_instance.db.connection_name}&connection_limit=${var.db_connection_limit}"
  secrets = {
    "database-url"   = local.database_url
    "admin-password" = var.admin_password
  }
}

resource "google_secret_manager_secret" "app" {
  for_each  = local.secrets
  secret_id = "${var.service_name}-${each.key}"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "app" {
  for_each    = local.secrets
  secret      = google_secret_manager_secret.app[each.key].id
  secret_data = each.value
}

# ---------- サービスアカウント(product-db 専用) ----------
resource "google_service_account" "run" {
  account_id   = "${var.service_name}-run"
  display_name = "Cloud Run service account for ${var.service_name}"
}

resource "google_project_iam_member" "cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.run.email}"
}

resource "google_storage_bucket_iam_member" "images" {
  bucket = google_storage_bucket.images.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.run.email}"
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

      # CPU・メモリはリクエスト処理中だけ課金(既定)。重い Excel 取込はサービスでは行わず Cloud Run ジョブで実行する
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
      # Excel取込の実行先(このジョブを起動する。未設定ならサービス内で実行=ローカルと同じ)
      env {
        name  = "IMPORT_JOB_NAME"
        value = google_cloud_run_v2_job.import.id
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
    google_secret_manager_secret_version.app,
    google_secret_manager_secret_iam_member.run,
  ]

  lifecycle {
    # イメージは deploy.sh(gcloud run deploy)が更新する。Terraform 側で管理すると
    # terraform apply のたびに var.image(初期値はプレースホルダ)へ戻ってしまうため無視する
    ignore_changes = [client, client_version, template[0].containers[0].image]
  }
}

# ---------- Cloud Run ジョブ(Excel取込) ----------
# ブック全体をメモリに展開するため 512Mi のサービスでは処理できない。取込のときだけ起動し、実行中だけ課金される。
# サービスが DB に取込ジョブを登録し、ブックを GCS の imports/<ジョブID> に置いてから、IMPORT_JOB_ID を渡して起動する
resource "google_cloud_run_v2_job" "import" {
  name                = "${var.service_name}-import"
  location            = var.region
  deletion_protection = false

  template {
    task_count = 1
    template {
      service_account = google_service_account.run.email
      max_retries     = 0 # 失敗時に自動で再実行しない(取込は人が結果を見て再実行する)
      timeout         = "1800s"

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [google_sql_database_instance.db.connection_name]
        }
      }

      containers {
        image   = var.image
        command = ["node", "dist/scripts/run-import-job.js"]

        resources {
          limits = {
            cpu    = "1"
            memory = var.import_job_memory
          }
        }

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }

        env {
          name  = "GCS_BUCKET"
          value = google_storage_bucket.images.name
        }
        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.app["database-url"].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_secret_manager_secret_version.app,
    google_secret_manager_secret_iam_member.run,
  ]

  lifecycle {
    # イメージは deploy.sh(gcloud run jobs update)が更新する
    ignore_changes = [client, client_version, template[0].template[0].containers[0].image]
  }
}

# サービス(product-db-run SA)からこのジョブを環境変数を上書きして起動できるようにする(このジョブに限定)
resource "google_cloud_run_v2_job_iam_member" "import_runner" {
  name     = google_cloud_run_v2_job.import.name
  location = var.region
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.run.email}"
}

# report-app と同じく誰でもアクセス可能にし、アプリ側のログインで保護する
resource "google_cloud_run_v2_service_iam_member" "invoker" {
  name     = google_cloud_run_v2_service.app.name
  location = var.region
  role     = "roles/run.invoker"
  member   = var.invoker_member
}

# ---------- 独自ドメイン(任意) ----------
# report-app が作った Cloud DNS ゾーン(NS委任済み)に、このサービス用のホスト名を追加する。
# ゾーン自体は report-app の管理なので data で参照するだけ。変数が空のあいだは何も作らない
locals {
  use_custom_domain = var.custom_domain != ""
}

data "google_dns_managed_zone" "shared" {
  count = local.use_custom_domain ? 1 : 0
  name  = var.dns_managed_zone
}

# 事前に Search Console でドメインの所有権確認が済んでいないと作成に失敗する(report-app で確認済みの親ドメイン配下なら不要)
resource "google_cloud_run_domain_mapping" "app" {
  count    = local.use_custom_domain ? 1 : 0
  location = var.region
  name     = var.custom_domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.app.name
  }

  lifecycle {
    precondition {
      condition     = endswith("${var.custom_domain}.", ".${data.google_dns_managed_zone.shared[0].dns_name}")
      error_message = "custom_domain は共有ゾーン(${var.dns_managed_zone})の配下にしてください。"
    }
  }
}

resource "google_dns_record_set" "app" {
  count        = local.use_custom_domain ? 1 : 0
  managed_zone = data.google_dns_managed_zone.shared[0].name
  name         = "${var.custom_domain}."
  type         = "CNAME"
  ttl          = 300
  rrdatas      = ["ghs.googlehosted.com."]
}
