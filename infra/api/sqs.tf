locals {
  max_receive_count = 3
}

# scan queue + dlq

resource "aws_sqs_queue" "scan_jobs_dlq" {
  name                      = "${var.name_prefix}-scan-jobs-dlq"
  message_retention_seconds = 345600 # 4 days
}

resource "aws_sqs_queue" "scan_jobs" {
  name                       = "${var.name_prefix}-scan-jobs"
  visibility_timeout_seconds = 180  # worker extends this during a scan
  message_retention_seconds  = 3600 # 1 hour
  receive_wait_time_seconds  = 20   # long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.scan_jobs_dlq.arn
    maxReceiveCount     = local.max_receive_count
  })
}

# triage queue + dlq

resource "aws_sqs_queue" "triage_jobs_dlq" {
  name                      = "${var.name_prefix}-triage-jobs-dlq"
  message_retention_seconds = 345600 # 4 days
}

resource "aws_sqs_queue" "triage_jobs" {
  name                       = "${var.name_prefix}-triage-jobs"
  visibility_timeout_seconds = 120
  message_retention_seconds  = 86400 # 1 day
  receive_wait_time_seconds  = 20

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.triage_jobs_dlq.arn
    maxReceiveCount     = local.max_receive_count
  })
}
