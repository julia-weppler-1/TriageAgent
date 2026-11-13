variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "triageagent"
}

variable "bucket_suffix" {
  description = "Bucket names have to be globally unique, change this when testing in your own lab"
  type        = string
  default     = "team22"
}

variable "data_retention_days" {
  description = "How many days to keep scan data"
  type        = number
  default     = 90
}

variable "allowed_targets" {
  description = "Comma separated URL prefixes that pentest scans are allowed to hit"
  type        = string
  default     = "http://test-target:4000/"
}
