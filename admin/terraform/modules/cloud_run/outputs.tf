output "service_url" {
  description = "URL of the Cloud Run service"
  value       = google_cloud_run_v2_service.admin.uri
}

output "service_name" {
  description = "Name of the Cloud Run service"
  value       = google_cloud_run_v2_service.admin.name
}

output "service_id" {
  description = "ID of the Cloud Run service"
  value       = google_cloud_run_v2_service.admin.id
}

output "location" {
  description = "Location of the Cloud Run service"
  value       = google_cloud_run_v2_service.admin.location
}
