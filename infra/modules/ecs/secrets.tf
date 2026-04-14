resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "${local.name_prefix}/jwt-secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = random_password.jwt.result
}

resource "random_password" "refresh" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "refresh" {
  name                    = "${local.name_prefix}/refresh-secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "refresh" {
  secret_id     = aws_secretsmanager_secret.refresh.id
  secret_string = random_password.refresh.result
}
