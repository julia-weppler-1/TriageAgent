variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "triageagent"
}

variable "bucket_suffix" {
  description = "Bucket names are global, so change this when testing in your own lab (Sristi and Anurag)"
  type        = string
  default     = "team22"
}
