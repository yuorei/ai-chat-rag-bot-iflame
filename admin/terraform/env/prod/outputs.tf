output "admin_url" {
  description = "URL of the Admin Dashboard"
  value       = module.cloud_run.service_url
}

output "service_name" {
  description = "Name of the Cloud Run service"
  value       = module.cloud_run.service_name
}

output "service_account_email" {
  description = "Service account email"
  value       = module.iam.service_account_email
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.admin.repository_id}"
}
