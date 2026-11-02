# bucket for scan inputs and reports
resource "aws_s3_bucket" "scan_data" {
  bucket = "${var.name_prefix}-scan-data-${var.bucket_suffix}"
}

resource "aws_s3_bucket_public_access_block" "scan_data" {
  bucket = aws_s3_bucket.scan_data.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "scan_data" {
  bucket = aws_s3_bucket.scan_data.id

  rule {
    id     = "expire-scan-data"
    status = "Enabled"

    filter {}

    expiration {
      days = var.data_retention_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}
