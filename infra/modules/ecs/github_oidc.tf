data "tls_certificate" "github" {
  count = var.enable_github_oidc && var.github_oidc_create_provider ? 1 : 0
  url   = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.enable_github_oidc && var.github_oidc_create_provider ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github[0].certificates[0].sha1_fingerprint]
}

data "aws_iam_openid_connect_provider" "github_existing" {
  count = var.enable_github_oidc && !var.github_oidc_create_provider ? 1 : 0

  arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
}

locals {
  github_oidc_provider_arn = !var.enable_github_oidc ? null : (
    var.github_oidc_create_provider ? aws_iam_openid_connect_provider.github[0].arn : data.aws_iam_openid_connect_provider.github_existing[0].arn
  )
}

data "aws_iam_policy_document" "github_oidc_trust" {
  count = var.enable_github_oidc ? 1 : 0

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.github_oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:ref:${var.github_actions_branch_ref}"]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  count = var.enable_github_oidc ? 1 : 0

  name               = "${local.name_prefix}-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_oidc_trust[0].json

  tags = local.common_tags
}

data "aws_iam_policy_document" "github_actions_policy" {
  count = var.enable_github_oidc ? 1 : 0

  statement {
    sid    = "EcrAuth"
    effect = "Allow"
    actions = [
      "ecr:GetAuthorizationToken",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "EcrPush"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = [aws_ecr_repository.backend.arn]
  }

  statement {
    sid    = "EcsDeploy"
    effect = "Allow"
    actions = [
      "ecs:UpdateService",
      "ecs:DescribeServices",
    ]
    resources = [
      format(
        "arn:aws:ecs:%s:%s:service/%s/%s",
        var.aws_region,
        data.aws_caller_identity.current.account_id,
        aws_ecs_cluster.main.name,
        aws_ecs_service.backend.name,
      ),
    ]
  }
}

resource "aws_iam_role_policy" "github_actions_inline" {
  count = var.enable_github_oidc ? 1 : 0

  name   = "${local.name_prefix}-github-actions-inline"
  role   = aws_iam_role.github_actions[0].id
  policy = data.aws_iam_policy_document.github_actions_policy[0].json
}
