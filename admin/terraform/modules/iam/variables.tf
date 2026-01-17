variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "service_account_id" {
  description = "Service account ID for the admin dashboard"
  type        = string
  default     = "admin-dashboard-sa"
}
