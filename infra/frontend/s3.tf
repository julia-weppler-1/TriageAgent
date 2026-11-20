# S3 static website for the React dashboard. The built app is uploaded by the frontend-deploy GitHub Actions workflow

locals {
  frontend_bucket = "${var.name_prefix}-frontend-${var.bucket_suffix}"
}

# This bucket is just for the React app
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = local.frontend_bucket

  # enable website to be public
  block_public_policy     = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = local.frontend_bucket

  index_document {
    suffix = "index.html"
  }
}
resource "aws_s3_bucket_policy" "public_read" {
  bucket = local.frontend_bucket

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "arn:aws:s3:::${local.frontend_bucket}/*"
    }]
  })

  # policy is rejected until public policies are allowed above
  depends_on = [aws_s3_bucket_public_access_block.frontend]
}
