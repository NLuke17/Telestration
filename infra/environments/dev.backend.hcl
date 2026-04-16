# Same state bucket as prod; different key so dev/prod state files stay separate.

bucket         = "constellestration-prod"
key            = "telestration/dev/terraform.tfstate"
region         = "us-east-1"
encrypt        = true
use_lockfile   = true
