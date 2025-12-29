output "service_url" {
  description = "URL of the deployed Cloud Run service"
  value       = module.server.service_url
}

output "service_name" {
  description = "Name of the Cloud Run service"
  value       = module.server.service_name
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.server.repository_id}"
}

output "wif_provider" {
  description = "Workload Identity Provider for GitHub Actions (WIF_PROVIDER secret)"
  value       = module.github_actions_wif.workload_identity_provider
}

output "wif_service_account" {
  description = "Service Account for GitHub Actions (WIF_SERVICE_ACCOUNT secret)"
  value       = module.github_actions_wif.service_account_email
}
