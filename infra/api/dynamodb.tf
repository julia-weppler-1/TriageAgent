# main table for scans (worker heartbeat rows go here too)
# only need to declare the attributes used as keys
resource "aws_dynamodb_table" "scans" {
  name         = "${var.name_prefix}-scans"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "scanId"

  attribute {
    name = "scanId"
    type = "S"
  }

  attribute {
    name = "owner"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  attribute {
    name = "scanStatus"
    type = "S"
  }

  attribute {
    name = "updatedAt"
    type = "S"
  }

  # for the history page
  global_secondary_index {
    name            = "owner-createdAt"
    hash_key        = "owner"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # for the reaper to find stuck scans
  global_secondary_index {
    name            = "status-updatedAt"
    hash_key        = "scanStatus"
    range_key       = "updatedAt"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}
