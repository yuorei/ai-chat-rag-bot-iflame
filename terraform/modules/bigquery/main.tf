# Enable BigQuery API
resource "google_project_service" "bigquery" {
  project            = var.project_id
  service            = "bigquery.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "bigquery_datatransfer" {
  project            = var.project_id
  service            = "bigquerydatatransfer.googleapis.com"
  disable_on_destroy = false
}

# Create dataset
resource "google_bigquery_dataset" "logs" {
  dataset_id    = var.dataset_id
  friendly_name = "AI Chat Logs"
  description   = "Logging data for AI Chat iFlame"
  location      = var.location
  project       = var.project_id

  default_table_expiration_ms = var.default_table_expiration_days > 0 ? var.default_table_expiration_days * 24 * 60 * 60 * 1000 : null

  labels = var.labels

  depends_on = [google_project_service.bigquery]
}

# Chatbot events table
resource "google_bigquery_table" "chatbot_events" {
  dataset_id          = google_bigquery_dataset.logs.dataset_id
  table_id            = "chatbot_events"
  project             = var.project_id
  deletion_protection = var.deletion_protection

  time_partitioning {
    type  = "DAY"
    field = "event_timestamp"
  }

  clustering = ["chat_id", "event_type"]

  schema = file("${path.module}/schemas/chatbot_events.json")
}

# Management audit logs table
resource "google_bigquery_table" "management_audit_logs" {
  dataset_id          = google_bigquery_dataset.logs.dataset_id
  table_id            = "management_audit_logs"
  project             = var.project_id
  deletion_protection = var.deletion_protection

  time_partitioning {
    type  = "DAY"
    field = "event_timestamp"
  }

  clustering = ["user_id", "resource_type"]

  schema = file("${path.module}/schemas/management_audit_logs.json")
}

# Daily chat summary table
resource "google_bigquery_table" "daily_chat_summary" {
  dataset_id          = google_bigquery_dataset.logs.dataset_id
  table_id            = "daily_chat_summary"
  project             = var.project_id
  deletion_protection = var.deletion_protection

  time_partitioning {
    type  = "DAY"
    field = "date"
  }

  clustering = ["chat_id"]

  schema = file("${path.module}/schemas/daily_chat_summary.json")
}

# Service account for logging from Cloud Run
resource "google_service_account" "bq_logger" {
  account_id   = "bq-logger"
  display_name = "BigQuery Logger Service Account"
  project      = var.project_id
}

# Grant BigQuery Data Editor role
resource "google_project_iam_member" "bq_logger_data_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.bq_logger.email}"
}

# Grant BigQuery Job User role (required for streaming inserts)
resource "google_project_iam_member" "bq_logger_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.bq_logger.email}"
}

# Grant BigQuery Data Viewer role (required for scheduled queries to read data)
resource "google_project_iam_member" "bq_logger_data_viewer" {
  project = var.project_id
  role    = "roles/bigquery.dataViewer"
  member  = "serviceAccount:${google_service_account.bq_logger.email}"
}

# Service account key for Cloudflare Workers
resource "google_service_account_key" "bq_logger_key" {
  service_account_id = google_service_account.bq_logger.name
}

# Scheduled query for daily summary
resource "google_bigquery_data_transfer_config" "daily_summary" {
  display_name           = "Daily Chat Summary Aggregation"
  location               = var.location
  data_source_id         = "scheduled_query"
  schedule               = "every day 01:00"
  destination_dataset_id = google_bigquery_dataset.logs.dataset_id
  project                = var.project_id
  service_account_name   = google_service_account.bq_logger.email

  params = {
    destination_table_name_template = "daily_chat_summary"
    write_disposition               = "WRITE_APPEND"
    query                           = <<-EOT
      INSERT INTO `${var.project_id}.${var.dataset_id}.daily_chat_summary`
      SELECT
        DATE(event_timestamp) as date,
        chat_id,
        COUNT(*) as total_messages,
        COUNT(DISTINCT request_id) as unique_sessions,
        AVG(total_duration_ms) as avg_response_time_ms,
        SAFE_DIVIDE(COUNTIF(context_found = true), COUNT(*)) as context_found_rate,
        SAFE_DIVIDE(COUNTIF(error_code IS NOT NULL), COUNT(*)) as error_rate,
        SUM(COALESCE(tokens_input, 0) + COALESCE(tokens_output, 0)) as total_tokens_used
      FROM `${var.project_id}.${var.dataset_id}.chatbot_events`
      WHERE DATE(event_timestamp) = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
        AND event_type = 'chat_request'
      GROUP BY date, chat_id
    EOT
  }

  depends_on = [
    google_bigquery_table.chatbot_events,
    google_bigquery_table.daily_chat_summary,
    google_project_service.bigquery_datatransfer,
    google_project_iam_member.bq_logger_job_user,
    google_project_iam_member.bq_logger_data_viewer,
    google_project_iam_member.bq_logger_data_editor
  ]
}
