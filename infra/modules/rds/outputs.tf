output "database_url_secret_arn" {
  value = aws_secretsmanager_secret.database_url.arn
}

output "rds_address" {
  value = aws_db_instance.app.address
}
