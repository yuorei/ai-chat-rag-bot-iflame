terraform {
  required_version = ">= 1.0.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Uncomment to use GCS backend for remote state
  # backend "gcs" {
  #   bucket = "yuovision-terraform-state"
  #   prefix = "ai-chat-iflame/admin/prod"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "run" {
  project = var.project_id
  service = "run.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "artifactregistry" {
  project = var.project_id
  service = "artifactregistry.googleapis.com"

  disable_on_destroy = false
}


resource "google_project_service" "bigquery" {
  project = var.project_id
  service = "bigquery.googleapis.com"

  disable_on_destroy = false
}

# Artifact Registry for container images
resource "google_artifact_registry_repository" "admin" {
  location      = var.region
  repository_id = "ai-chat-admin"
  description   = "Docker repository for Admin Dashboard"
  format        = "DOCKER"

  depends_on = [google_project_service.artifactregistry]
}

# IAM module for service account
module "iam" {
  source = "../../modules/iam"

  project_id         = var.project_id
  service_account_id = "admin-dashboard-sa"
}

# Extract email addresses from authorized_members (remove "user:" prefix)
locals {
  authorized_emails = join(",", [
    for member in var.authorized_members :
    trimprefix(member, "user:")
  ])
}

# Cloud Run service
module "cloud_run" {
  source = "../../modules/cloud_run"

  project_id   = var.project_id
  region       = var.region
  service_name = "admin-dashboard"
  image        = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.admin.repository_id}/admin-dashboard:${var.image_tag}"
  port         = 3000
  cpu          = var.cpu
  memory       = var.memory
  min_instances = var.min_instances
  max_instances = var.max_instances

  service_account_email = module.iam.service_account_email
  authorized_members    = var.authorized_members
  allow_unauthenticated = var.allow_unauthenticated

  environment_variables = {
    MANAGEMENT_API_BASE_URL = var.management_api_base_url
    MANAGEMENT_API_KEY      = var.admin_api_key
    GCP_PROJECT_ID          = var.project_id
    BQ_DATASET_ID           = var.bq_dataset_id
    NODE_ENV                = "production"
    NEXTAUTH_SECRET         = var.nextauth_secret
    NEXTAUTH_URL            = var.nextauth_url
    GOOGLE_CLIENT_ID        = var.google_client_id
    GOOGLE_CLIENT_SECRET    = var.google_client_secret
    AUTHORIZED_EMAILS       = local.authorized_emails
    AUTH_TRUST_HOST         = "true"
  }

  depends_on = [
    google_project_service.run,
    google_artifact_registry_repository.admin,
    module.iam
  ]
}

