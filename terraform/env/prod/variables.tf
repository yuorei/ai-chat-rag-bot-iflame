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
  description = "Container image tag to deploy"
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
  default     = "1Gi"
}

variable "min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 10
}

variable "gemini_model_name" {
  description = "Gemini model name to use"
  type        = string
  default     = "gemini-2.0-flash-lite"
}

variable "qdrant_url" {
  description = "Qdrant vector database URL"
  type        = string
}

variable "mgmt_api_base_url" {
  description = "Management API base URL"
  type        = string
  default     = ""
}

variable "mgmt_api_cache_ttl" {
  description = "Management API cache TTL in seconds"
  type        = string
  default     = "30"
}

variable "mgmt_api_timeout_sec" {
  description = "Management API timeout in seconds"
  type        = string
  default     = "5"
}

variable "gemini_api_key" {
  description = "Gemini API Key"
  type        = string
  sensitive   = true
}

variable "qdrant_api_key" {
  description = "Qdrant API Key"
  type        = string
  sensitive   = true
}

variable "mgmt_admin_api_key" {
  description = "Management Admin API Key"
  type        = string
  sensitive   = true
}

variable "github_repository" {
  description = "GitHub repository in format owner/repo"
  type        = string
}

variable "allowed_repositories" {
  description = "List of GitHub repositories allowed to use WIF"
  type        = list(string)
  default     = []
}
