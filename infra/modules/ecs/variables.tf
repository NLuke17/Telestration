variable "project_name" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "alb_security_group_id" {
  type = string
}

variable "ecs_tasks_security_group_id" {
  type = string
}

variable "database_url_secret_arn" {
  type = string
}

variable "fargate_cpu" {
  type = number
}

variable "fargate_memory" {
  type = number
}

variable "fargate_cpu_architecture" {
  type        = string
  description = "ARM64 for images built on Apple Silicon (default). X86_64 if you push linux/amd64 only (e.g. docker buildx --platform linux/amd64 from CI)."
  default     = "ARM64"

  validation {
    condition     = contains(["ARM64", "X86_64"], var.fargate_cpu_architecture)
    error_message = "fargate_cpu_architecture must be ARM64 or X86_64."
  }
}

variable "enable_github_oidc" {
  type = bool
}

variable "github_org" {
  type    = string
  default = ""
}

variable "github_repo" {
  type    = string
  default = ""
}
