output "frontend_bucket_name" {
  value = local.frontend_bucket
}

output "website_url" {
  value = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
}
