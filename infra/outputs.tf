output "cloudfront_domain_name" {
  description = "Open this URL after uploading the frontend build to S3 (same origin for API + WebSocket via CloudFront)."
  value       = module.s3.cloudfront_domain_name
}

output "cloudfront_url" {
  description = "HTTPS URL for the site."
  value       = module.s3.cloudfront_url
}

output "cloudfront_distribution_id" {
  description = "Use with aws cloudfront create-invalidation."
  value       = module.s3.cloudfront_distribution_id
}

output "alb_dns_name" {
  description = "ALB hostname (HTTP). Prefer the CloudFront URL in production so traffic stays on HTTPS and path routing works."
  value       = module.ecs.alb_dns_name
}

output "ecr_backend_repository_url" {
  description = "docker build -t backend:latest . && docker tag ... && docker push"
  value       = module.ecs.ecr_backend_repository_url
}

output "ecs_cluster_name" {
  value = module.ecs.ecs_cluster_name
}

output "ecs_service_name" {
  value = module.ecs.ecs_service_name
}

output "frontend_s3_bucket" {
  description = "Sync dist/ here after vite build (same-origin empty VITE_* env)."
  value       = module.s3.frontend_s3_bucket
}

output "github_actions_role_arn" {
  description = "Set as AWS_ROLE_ARN in GitHub Actions when enable_github_oidc is true."
  value       = module.ecs.github_actions_role_arn
}

output "rds_endpoint" {
  description = "Postgres endpoint (credentials are in Secrets Manager, not printed here)."
  value       = module.rds.rds_address
}
