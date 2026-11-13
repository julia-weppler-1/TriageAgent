# scan-api lambda (POST /scans and GET /scans/{scanId})
# learner lab doesn't let us create iam roles, so the lambda uses the existing LabRole

data "aws_caller_identity" "current" {}

locals {
  lab_role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/LabRole"
}

# only index.mjs goes in the zip, the aws sdk is already in the lambda runtime
data "archive_file" "scan_api" {
  type        = "zip"
  source_file = "${path.module}/../../api/scan-api/index.mjs"
  output_path = "${path.module}/build/scan-api.zip"
}

resource "aws_cloudwatch_log_group" "scan_api" {
  name              = "/aws/lambda/${var.name_prefix}-scan-api"
  retention_in_days = 14
}

resource "aws_lambda_function" "scan_api" {
  function_name    = "${var.name_prefix}-scan-api"
  role             = local.lab_role_arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = data.archive_file.scan_api.output_path
  source_code_hash = data.archive_file.scan_api.output_base64sha256
  timeout          = 10
  memory_size      = 256

  environment {
    variables = {
      TABLE_NAME      = aws_dynamodb_table.scans.name
      BUCKET_NAME     = local.scan_data_bucket
      SCAN_QUEUE_URL  = aws_sqs_queue.scan_jobs.url
      ALLOWED_TARGETS = var.allowed_targets
    }
  }

  # make sure terraform owns the log group before lambda writes to it
  depends_on = [aws_cloudwatch_log_group.scan_api]
}
