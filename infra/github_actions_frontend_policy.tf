# GitHub Actions needs S3 sync + CloudFront invalidation for the frontend; ECS module only grants ECR + ECS.
resource "aws_iam_role_policy" "github_actions_frontend" {
  count = var.enable_github_oidc ? 1 : 0
  name  = "${var.project_name}-gha-frontend"
  role  = module.ecs.github_actions_role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "FrontendS3"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ]
        Resource = [
          module.s3.frontend_s3_bucket_arn,
          "${module.s3.frontend_s3_bucket_arn}/*",
        ]
      },
      {
        Sid      = "FrontendCloudFront"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = module.s3.cloudfront_distribution_arn
      },
    ]
  })
}
