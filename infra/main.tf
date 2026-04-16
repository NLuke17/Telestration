module "vpc" {
  source       = "./modules/vpc"
  project_name = var.project_name
}

module "rds" {
  source                = "./modules/rds"
  project_name          = var.project_name
  private_subnet_ids    = module.vpc.private_subnet_ids
  rds_security_group_id = module.vpc.rds_security_group_id
  db_username           = var.db_username
  db_name               = var.db_name
  db_instance_class     = var.db_instance_class
  db_engine_version     = var.db_engine_version
  db_allocated_storage  = var.db_allocated_storage
}

module "ecs" {
  source                      = "./modules/ecs"
  depends_on                  = [module.vpc, module.rds]
  project_name                = var.project_name
  aws_region                  = var.aws_region
  vpc_id                      = module.vpc.vpc_id
  public_subnet_ids           = module.vpc.public_subnet_ids
  alb_security_group_id       = module.vpc.alb_security_group_id
  ecs_tasks_security_group_id = module.vpc.ecs_tasks_security_group_id
  database_url_secret_arn     = module.rds.database_url_secret_arn
  fargate_cpu                 = var.fargate_cpu
  fargate_memory              = var.fargate_memory
  fargate_cpu_architecture    = var.fargate_cpu_architecture
  enable_github_oidc          = var.enable_github_oidc
  github_oidc_create_provider = var.github_oidc_create_provider
  github_actions_branch_ref   = var.github_actions_branch_ref
  github_org                  = var.github_org
  github_repo                 = var.github_repo
}

module "s3" {
  source       = "./modules/s3"
  project_name = var.project_name
  alb_dns_name = module.ecs.alb_dns_name
}
