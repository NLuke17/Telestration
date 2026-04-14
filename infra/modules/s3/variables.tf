variable "project_name" {
  type = string
}

variable "alb_dns_name" {
  type        = string
  description = "ALB DNS name used as CloudFront custom origin for /api and /ws."
}
