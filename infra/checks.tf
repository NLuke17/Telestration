check "github_oidc_configuration" {
  assert {
    condition = (
      !var.enable_github_oidc ||
      (length(trimspace(var.github_org)) > 0 && length(trimspace(var.github_repo)) > 0)
    )
    error_message = "When enable_github_oidc is true, set github_org and github_repo (non-empty)."
  }
}
