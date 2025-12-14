variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "Environment must be either 'dev' or 'prod'."
  }
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "datavibes-api"
}

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "eu-central-1"
}

variable "github_token" {
  description = "GitHub Personal Access Token"
  type        = string
  sensitive   = true
}

variable "github_repository" {
  description = "GitHub repository (owner/repo)"
  type        = string
}

variable "domain_name" {
  description = "Base domain name"
  type        = string
  default     = "datavibes.datareply.de"
}
