variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "dataset_id" {
  description = "BigQuery dataset ID"
  type        = string
  default     = "ai_chat_logs"
}

variable "location" {
  description = "BigQuery dataset location"
  type        = string
  default     = "asia-northeast1"
}

variable "default_table_expiration_days" {
  description = "Default table expiration in days (0 for never)"
  type        = number
  default     = 365
}

variable "deletion_protection" {
  description = "Enable deletion protection for tables"
  type        = bool
  default     = true
}

variable "labels" {
  description = "Labels for the dataset"
  type        = map(string)
  default     = {}
}
