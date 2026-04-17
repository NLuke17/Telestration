# Terraform state bucket (not the same as ECS/RDS project_name in tfvars).
# Your bucket: constellestration-prod — enable versioning if you have not yet:
#   aws s3api put-bucket-versioning --bucket constellestration-prod --versioning-configuration Status=Enabled

bucket         = "constellestration-prod"
key            = "telestration/prod/terraform.tfstate"
region         = "us-east-1"
encrypt        = true
use_lockfile   = true
