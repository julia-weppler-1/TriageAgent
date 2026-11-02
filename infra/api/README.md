# infra/api

Terraform for the API side's data layer: the S3 bucket for scan files, the DynamoDB scans table, and the SQS queues between the API and the workers.

Lambda, API Gateway and the reaper will be added to this folder later.

## What it creates

| Resource | Name |
|---|---|
| S3 bucket (private, files deleted after 90 days) | `triageagent-scan-data-team22` |
| DynamoDB table | `triageagent-scans` |
| SQS scan queue + dead-letter queue | `triageagent-scan-jobs`, `triageagent-scan-jobs-dlq` |
| SQS triage queue + dead-letter queue | `triageagent-triage-jobs`, `triageagent-triage-jobs-dlq` |

State is stored in the shared bucket under `api/terraform.tfstate`. Same deploy process as the network folder: open a PR, and after review it's applied from the shared deploy account.

## Outputs

Other folders can read these with `terraform_remote_state` (key `api/terraform.tfstate`):

`scans_table_name`, `scans_table_arn`, `scan_data_bucket_name`, `scan_data_bucket_arn`, `scan_queue_url`, `scan_queue_arn`, `scan_dlq_url`, `triage_queue_url`, `triage_queue_arn`, `triage_dlq_url`

## Testing in your own lab

The backend points at the shared state bucket in the deploy account, so to try this in your own Learner Lab:

1. Create `backend_override.tf` in this folder with `terraform { backend "local" {} }`. **Don't commit it.**
2. Run `terraform init`, then `terraform apply -var="bucket_suffix=<something unique>"`. Bucket names are global, so it can't be `team22`.
3. Run `terraform destroy` when you're done, and delete the override file.

---

## DynamoDB table: `triageagent-scans`

- Partition key: `scanId` (string), no sort key
- Use `new Date().toISOString()` for every timestamp so they sort correctly
- `expiresAt` (epoch seconds) is the TTL field. DynamoDB deletes the row after that time

### Indexes

| Index | Partition key | Sort key | Used by |
|---|---|---|---|
| `owner-createdAt` | `owner` | `createdAt` | history page |
| `status-updatedAt` | `scanStatus` | `updatedAt` | reaper (finds stuck scans) |

The workers only read and write rows by `scanId`, so they don't need the indexes.

### Scan row fields

| Field | Set by | Notes |
|---|---|---|
| `scanId` | scan-api | `scn_<uuid>` |
| `type` | scan-api | `SAST` or `PENTEST` |
| `source`, `owner` | scan-api | `owner` is `dashboard` or `github#org/repo` |
| `repo`, `prNumber`, `commitSha` | scan-api | GitHub scans only |
| `targetUrl` | scan-api | pentest only |
| `inputKey` | scan-api | `inputs/{scanId}.json` |
| `createdAt`, `expiresAt` | scan-api | |
| `scanStatus` | scan-api, scan-worker, reaper | `QUEUED`, `RUNNING`, `RETRYING`, `COMPLETED`, `FAILED` |
| `statusReason` | scan-worker, reaper | shown on the dashboard when a scan fails or retries |
| `attempts` | scan-worker | from SQS `ApproximateReceiveCount`, starts at 0 |
| `updatedAt` | everyone who writes | scan-worker updates it every 15 s while scanning |
| `workerId`, `startedAt`, `completedAt` | scan-worker | |
| `reportKey` | scan-worker | `reports/{scanId}/{attempt}.json` |
| `score`, `grade`, `highCount`, `mediumCount`, `lowCount`, `totalFindings` | scan-worker | from the raw scanner output, not the AI |
| `alertSent` | scan-worker | true once the HIGH alert email is sent |
| `triageStatus` | scan-worker, triage-worker | scan-worker sets `PENDING`, triage-worker sets `DONE` or `FAILED` |
| `triageKey`, `aiSummaryShort`, `triageCompletedAt` | triage-worker | `aiSummaryShort` max 500 chars |

### Heartbeat rows

Each worker keeps one row up to date so `/health` can say whether the scanner is online.

| Field | Value |
|---|---|
| `scanId` | `HEARTBEAT#scan-worker` or `HEARTBEAT#triage-worker` |
| `itemType` | `HEARTBEAT` |
| `lastSeen` | ISO timestamp |
| `currentScanId` | the scan being worked on, or `null` |

Update it every 20 s, **even when idle**. `/health` reports offline if `lastSeen` is older than 60 s. Don't put `owner` or `scanStatus` on these rows, otherwise they show up in the history list.

### Write rules

These stop two attempts of the same scan from overwriting each other. Use them as `ConditionExpression`s.

| When | Set | Only if |
|---|---|---|
| scan-api creates a scan | `QUEUED`, `attempts = 0` | the row doesn't exist yet |
| scan-worker starts | `RUNNING`, `attempts = n` | `scanStatus` is `QUEUED`, `RETRYING` or `RUNNING`, and `attempts < n` |
| scan-worker heartbeat | `updatedAt` | `attempts = n` and `scanStatus` is `RUNNING` or `RETRYING` |
| scan-worker finishes | `COMPLETED` + results | `attempts = n` and `scanStatus` is `RUNNING` or `RETRYING` |
| scan-worker gives up (bad input) | `FAILED` + `statusReason` | `attempts = n` |
| triage-worker finishes | `triageStatus` `DONE` or `FAILED` | `triageStatus = PENDING` and `attempts` matches the triage job's `attempt` |
| reaper | `RETRYING` or `FAILED` | the row hasn't changed since the reaper read it |

`n` is the `ApproximateReceiveCount` of the SQS message.

If a condition fails, a newer attempt owns the scan. Stop, and **don't delete the SQS message**.

Order when a scan succeeds: write the report to S3 → mark `COMPLETED` → send the SNS alert if `highCount > 0` (then set `alertSent`) → send the triage job → delete the SQS message.

---

## SQS messages

### `triageagent-scan-jobs`

Sent by scan-api, read by scan-worker.

```json
{
  "version": 1,
  "scanId": "scn_3f9c2a1e-...",
  "type": "SAST",
  "inputKey": "inputs/scn_3f9c2a1e-....json",
  "createdAt": "2026-11-03T14:02:11.000Z"
}
```

- Visibility timeout is 180 s. Extend it while a scan is running (and stop scans that run past about 3 min)
- Messages are dropped after 1 hour
- After 3 failed receives the message moves to `triageagent-scan-jobs-dlq`

### `triageagent-triage-jobs`

Sent by scan-worker, read by triage-worker.

```json
{
  "version": 1,
  "scanId": "scn_3f9c2a1e-...",
  "attempt": 2,
  "reportKey": "reports/scn_3f9c2a1e-.../2.json"
}
```

- Visibility timeout is 120 s, messages kept for 1 day, 3 tries then `triageagent-triage-jobs-dlq`

---

## S3 layout: `triageagent-scan-data-team22`

| Key | Written by |
|---|---|
| `inputs/{scanId}.json` | scan-api |
| `reports/{scanId}/{attempt}.json` | scan-worker |
| `reports/{scanId}/{attempt}.triage.json` | triage-worker |

Input files:

```json
{ "version": 1, "type": "SAST", "files": [ { "path": "pasted.js", "code": "..." } ] }
```

```json
{ "version": 1, "type": "PENTEST", "targetUrl": "http://test-target:4000/api/users" }
```

Code pasted on the dashboard is saved as one file called `pasted.js`, so SAST input always has the same shape.
