# bucket for scan inputs and reports
# the bucket itself is created outside terraform because learner lab blocks a read
# the aws provider does after creating a bucket. terraform manages the settings
locals {
  scan_data_bucket = "${var.name_prefix}-scan-data-${var.bucket_suffix}"
}

resource "aws_s3_bucket_public_access_block" "scan_data" {
  bucket = local.scan_data_bucket

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "scan_data" {
  bucket = local.scan_data_bucket

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
