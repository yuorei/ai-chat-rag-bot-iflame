output "service_account_email" {
  description = "Email of the admin dashboard service account"
  value       = google_service_account.admin_dashboard.email
}

output "service_account_id" {
  description = "ID of the admin dashboard service account"
  value       = google_service_account.admin_dashboard.id
}

output "service_account_name" {
  description = "Full name of the admin dashboard service account"
  value       = google_service_account.admin_dashboard.name
}
