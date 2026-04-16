terraform {
  required_version = ">= 1.11.0"

  # After you create the state bucket (see tutorial), init with:
  #   terraform init -backend-config=environments/dev.backend.hcl
  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
