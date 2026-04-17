output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_url" {
  value = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "frontend_s3_bucket" {
  value = aws_s3_bucket.frontend.id
}

output "frontend_s3_bucket_arn" {
  value = aws_s3_bucket.frontend.arn
}

output "cloudfront_distribution_arn" {
  value = aws_cloudfront_distribution.frontend.arn
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.frontend.id
}
