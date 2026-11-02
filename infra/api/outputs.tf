# used by the workers terraform

output "scans_table_name" {
  value = aws_dynamodb_table.scans.name
}

output "scans_table_arn" {
  value = aws_dynamodb_table.scans.arn
}

output "scan_data_bucket_name" {
  value = aws_s3_bucket.scan_data.bucket
}

output "scan_data_bucket_arn" {
  value = aws_s3_bucket.scan_data.arn
}

output "scan_queue_url" {
  value = aws_sqs_queue.scan_jobs.url
}

output "scan_queue_arn" {
  value = aws_sqs_queue.scan_jobs.arn
}

output "scan_dlq_url" {
  value = aws_sqs_queue.scan_jobs_dlq.url
}

output "triage_queue_url" {
  value = aws_sqs_queue.triage_jobs.url
}

output "triage_queue_arn" {
  value = aws_sqs_queue.triage_jobs.arn
}

output "triage_dlq_url" {
  value = aws_sqs_queue.triage_jobs_dlq.url
}
