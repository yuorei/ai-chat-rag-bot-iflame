variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "pool_id" {
  description = "Workload Identity Pool ID"
  type        = string
  default     = "github-pool"
}

variable "pool_display_name" {
  description = "Workload Identity Pool display name"
  type        = string
  default     = "GitHub Actions Pool"
}

variable "provider_id" {
  description = "Workload Identity Pool Provider ID"
  type        = string
  default     = "github-provider"
}

variable "provider_display_name" {
  description = "Workload Identity Pool Provider display name"
  type        = string
  default     = "GitHub Provider"
}

variable "service_account_id" {
  description = "Service Account ID"
  type        = string
  default     = "github-actions-deploy"
}

variable "service_account_display_name" {
  description = "Service Account display name"
  type        = string
  default     = "GitHub Actions Deploy"
}

variable "github_repository" {
  description = "GitHub repository in format owner/repo"
  type        = string
}

variable "allowed_repositories" {
  description = "List of GitHub repositories allowed to use this provider"
  type        = list(string)
  default     = []
}
