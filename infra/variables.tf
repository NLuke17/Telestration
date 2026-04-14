variable "aws_region" {
  type        = string
  description = "Region for ECS, RDS, ALB, ECR (CloudFront is global; ACM for alternate domains uses us-east-1 only when you add custom domains)."
  default     = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "telestration"
}

variable "db_username" {
  type    = string
  default = "telestration"
}

variable "db_name" {
  type    = string
  default = "telestration"
}

variable "budget_amount" {
  type        = string
  description = "Monthly cost budget (USD) for AWS Budgets email alert."
  default     = "90"
}

variable "budget_notification_emails" {
  type        = list(string)
  description = "Emails that receive budget notifications (must confirm subscription)."
  default     = []
}

variable "github_org" {
  type        = string
  description = "GitHub org or username for OIDC trust (optional)."
  default     = ""
}

variable "github_repo" {
  type        = string
  description = "GitHub repository name under github_org (optional)."
  default     = ""
}

variable "enable_github_oidc" {
  type        = bool
  description = "Create IAM OIDC provider + role for GitHub Actions (push ECR, force ECS deployment)."
  default     = false
}

variable "fargate_cpu" {
  type        = number
  description = "Fargate task CPU units (256 = 0.25 vCPU)."
  default     = 512
}

variable "fargate_memory" {
  type        = number
  description = "Fargate task memory (MiB)."
  default     = 1024
}

variable "fargate_cpu_architecture" {
  type        = string
  description = "ECS Fargate platform: ARM64 matches docker build on Apple Silicon; X86_64 for linux/amd64 images (typical Intel/CI)."
  default     = "ARM64"

  validation {
    condition     = contains(["ARM64", "X86_64"], var.fargate_cpu_architecture)
    error_message = "Must be ARM64 or X86_64."
  }
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_instance_class" {
  type        = string
  description = "Smallest Postgres instance; db.t4g.micro is typical for dev/small traffic."
  default     = "db.t4g.micro"
}

variable "db_engine_version" {
  type        = string
  description = "Set to a version available in your region (RDS → Create database → Engine version)."
  default     = "16.4"
}
