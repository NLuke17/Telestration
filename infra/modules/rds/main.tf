locals {
  name_prefix = var.project_name
  common_tags = {
    Project     = var.project_name
    Environment = "production"
  }
}

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnets"
  subnet_ids = var.private_subnet_ids

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-db-subnet-group" })
}

resource "aws_db_instance" "app" {
  identifier                 = "${local.name_prefix}-postgres"
  engine                     = "postgres"
  engine_version             = var.db_engine_version
  instance_class             = var.db_instance_class
  allocated_storage          = var.db_allocated_storage
  storage_type               = "gp3"
  db_name                    = var.db_name
  username                   = var.db_username
  password                   = random_password.db.result
  db_subnet_group_name       = aws_db_subnet_group.main.name
  vpc_security_group_ids     = [var.rds_security_group_id]
  skip_final_snapshot        = true
  deletion_protection        = false
  publicly_accessible        = false
  backup_retention_period    = 1
  apply_immediately          = true
  auto_minor_version_upgrade = true

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-rds" })
}

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${local.name_prefix}/database-url"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id
  # sslmode=require: RDS Postgres often rejects or flakes on non-TLS without this (migrate + pg Pool).
  secret_string = format(
    "postgresql://%s:%s@%s:%s/%s?schema=public&sslmode=require",
    var.db_username,
    random_password.db.result,
    aws_db_instance.app.address,
    aws_db_instance.app.port,
    var.db_name
  )
}
