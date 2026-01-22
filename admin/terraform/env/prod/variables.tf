variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "asia-northeast1"
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "cpu" {
  description = "CPU allocation for Cloud Run"
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Memory allocation for Cloud Run"
  type        = string
  default     = "512Mi"
}

variable "min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 5
}

variable "authorized_members" {
  description = "List of IAM members authorized to access the admin dashboard"
  type        = list(string)
}

variable "management_api_base_url" {
  description = "Base URL of the Management Server API"
  type        = string
}

variable "admin_api_key" {
  description = "API key for admin access to Management Server"
  type        = string
  sensitive   = true
}

variable "bq_dataset_id" {
  description = "BigQuery dataset ID for analytics"
  type        = string
}

variable "allow_unauthenticated" {
  description = "Allow unauthenticated access (use app-level auth instead of Cloud Run IAM)"
  type        = bool
  default     = true
}

variable "nextauth_secret" {
  description = "Secret for NextAuth.js session encryption"
  type        = string
  sensitive   = true
}

variable "google_client_id" {
  description = "Google OAuth Client ID"
  type        = string
}

variable "google_client_secret" {
  description = "Google OAuth Client Secret"
  type        = string
  sensitive   = true
}

variable "nextauth_url" {
  description = "Base URL for NextAuth.js callbacks"
  type        = string
}
