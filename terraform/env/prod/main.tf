terraform {
  required_version = ">= 1.0.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Backend configuration - uncomment and configure for remote state
  # backend "gcs" {
  #   bucket = ""
  #   prefix = "ai-chat-iflame/prod"
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

# Artifact Registry for container images
resource "google_artifact_registry_repository" "server" {
  location      = var.region
  repository_id = "ai-chat-iflame"
  description   = "Docker repository for AI Chat iFlame server"
  format        = "DOCKER"

  depends_on = [google_project_service.artifactregistry]
}

# Cloud Run service
module "server" {
  source = "../../modules/cloud_run"

  project_id   = var.project_id
  region       = var.region
  service_name = "ai-chat-iflame-server"
  image        = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.server.repository_id}/server:${var.image_tag}"
  port         = 8000
  cpu          = var.cpu
  memory       = var.memory
  min_instances = var.min_instances
  max_instances = var.max_instances

  environment_variables = {
    FLASK_ENV            = "production"
    FLASK_APP            = "app.py"
    GEMINI_MODEL_NAME    = var.gemini_model_name
    QDRANT_URL           = var.qdrant_url
    MGMT_API_BASE_URL    = var.mgmt_api_base_url
    MGMT_API_CACHE_TTL   = var.mgmt_api_cache_ttl
    MGMT_API_TIMEOUT_SEC = var.mgmt_api_timeout_sec
    MGMT_ADMIN_API_KEY   = var.mgmt_admin_api_key
    GEMINI_API_KEY       = var.gemini_api_key
    QDRANT_API_KEY       = var.qdrant_api_key
  }

  allow_unauthenticated = true

  depends_on = [
    google_project_service.run,
    google_artifact_registry_repository.server
  ]
}

# GitHub Actions Workload Identity Federation
module "github_actions_wif" {
  source = "../../modules/github_actions_wif"

  project_id           = var.project_id
  github_repository    = var.github_repository
  allowed_repositories = var.allowed_repositories
}
