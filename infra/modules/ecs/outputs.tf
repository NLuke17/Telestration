output "alb_dns_name" {
  value = aws_lb.app.dns_name
}

output "ecr_backend_repository_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.backend.name
}

output "github_actions_role_arn" {
  value       = try(aws_iam_role.github_actions[0].arn, null)
  description = "Null unless enable_github_oidc is true."
}

output "github_actions_role_name" {
  value       = try(aws_iam_role.github_actions[0].name, null)
  description = "Null unless enable_github_oidc is true. Use for attaching extra IAM policies at the root module."
}
