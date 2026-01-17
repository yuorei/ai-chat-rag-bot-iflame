# Service Account for Admin Dashboard
resource "google_service_account" "admin_dashboard" {
  account_id   = var.service_account_id
  display_name = "Admin Dashboard Service Account"
  description  = "Service account for the admin dashboard Cloud Run service"
  project      = var.project_id
}

# BigQuery Data Viewer role
resource "google_project_iam_member" "bigquery_data_viewer" {
  project = var.project_id
  role    = "roles/bigquery.dataViewer"
  member  = "serviceAccount:${google_service_account.admin_dashboard.email}"
}

# BigQuery Job User role (required to run queries)
resource "google_project_iam_member" "bigquery_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.admin_dashboard.email}"
}
