output "dataset_id" {
  description = "The BigQuery dataset ID"
  value       = google_bigquery_dataset.logs.dataset_id
}

output "dataset_full_id" {
  description = "The full BigQuery dataset ID (project:dataset)"
  value       = "${var.project_id}:${google_bigquery_dataset.logs.dataset_id}"
}

output "chatbot_events_table_id" {
  description = "Chatbot events table ID"
  value       = google_bigquery_table.chatbot_events.table_id
}

output "management_audit_logs_table_id" {
  description = "Management audit logs table ID"
  value       = google_bigquery_table.management_audit_logs.table_id
}

output "daily_chat_summary_table_id" {
  description = "Daily chat summary table ID"
  value       = google_bigquery_table.daily_chat_summary.table_id
}

output "service_account_email" {
  description = "Service account email for BigQuery logging"
  value       = google_service_account.bq_logger.email
}

output "service_account_key_json" {
  description = "Service account key JSON (base64 encoded) for Cloudflare Workers"
  value       = google_service_account_key.bq_logger_key.private_key
  sensitive   = true
}
