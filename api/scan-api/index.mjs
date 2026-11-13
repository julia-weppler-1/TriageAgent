// scan-api lambda: takes scan requests and queues them for the workers.
// It never talks to EC2. It only writes to S3, DynamoDB and SQS.

import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// created once and reused while the lambda stays warm
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const sqs = new SQSClient({});

const { TABLE_NAME, BUCKET_NAME, SCAN_QUEUE_URL } = process.env;
const ALLOWED_TARGETS = (process.env.ALLOWED_TARGETS || "").split(",").filter(Boolean);
const MAX_CODE_BYTES = 200 * 1024;
const RETENTION_DAYS = 90;

export const handler = async (event) => {
  const route = `${event.httpMethod} ${event.resource}`;
  try {
    if (route === "POST /scans") return await createScan(event);
    if (route === "GET /scans/{scanId}") return await getScan(event.pathParameters?.scanId);
    return error(404, "NOT_FOUND", `No route for ${route}`);
  } catch (err) {
    console.error(err);
    return error(500, "INTERNAL_ERROR", "Something went wrong.");
  }
};

async function createScan(event) {
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return error(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  // check the input and turn it into the format the worker expects
  let input;
  if (body.type === "SAST") {
    if (typeof body.code !== "string" || body.code.length === 0) {
      return error(400, "MISSING_CODE", "SAST scans need some code.");
    }
    if (Buffer.byteLength(body.code) > MAX_CODE_BYTES) {
      return error(400, "INPUT_TOO_LARGE", "Code must be under 200 KB.");
    }
    // dashboard pastes are stored as one file so the worker only handles one shape
    input = { version: 1, type: "SAST", files: [{ path: "pasted.js", code: body.code }] };
  } else if (body.type === "PENTEST") {
    const url = body.targetUrl;
    if (typeof url !== "string" || !ALLOWED_TARGETS.some((prefix) => url.startsWith(prefix))) {
      return error(400, "TARGET_NOT_ALLOWED", "This URL is not on the allowlist.");
    }
    input = { version: 1, type: "PENTEST", targetUrl: url };
  } else {
    return error(400, "INVALID_TYPE", "type must be SAST or PENTEST.");
  }

  const scanId = `scn_${randomUUID()}`;
  const now = new Date().toISOString();
  const inputKey = `inputs/${scanId}.json`;

  // 1. save the input first so the worker can always find it
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: inputKey,
    Body: JSON.stringify(input),
    ContentType: "application/json",
  }));

  // 2. create the scan record, the condition stops us from overwriting an existing scan
  const item = {
    scanId,
    itemType: "SCAN",
    type: input.type,
    source: "dashboard",
    owner: "dashboard",
    inputKey,
    scanStatus: "QUEUED",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: Math.floor(Date.now() / 1000) + RETENTION_DAYS * 24 * 60 * 60,
    ...(input.type === "SAST" ? { fileCount: 1 } : { targetUrl: input.targetUrl }),
  };
  await db.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
    ConditionExpression: "attribute_not_exists(scanId)",
  }));

  // 3. queue the job last, so a worker never gets a job that has no record.
  // if this step fails the scan stays QUEUED and the reaper marks it FAILED after 60 min
  await sqs.send(new SendMessageCommand({
    QueueUrl: SCAN_QUEUE_URL,
    MessageBody: JSON.stringify({ version: 1, scanId, type: input.type, inputKey, createdAt: now }),
  }));

  return json(202, { scanId, scanStatus: "QUEUED" });
}

async function getScan(scanId) {
  if (!scanId) return error(400, "MISSING_SCAN_ID", "scanId is required.");

  const { Item } = await db.send(new GetCommand({ TableName: TABLE_NAME, Key: { scanId } }));

  // the itemType check keeps heartbeat rows from being returned as scans
  if (!Item || Item.itemType !== "SCAN") {
    return error(404, "SCAN_NOT_FOUND", "No scan with that ID.");
  }

  // TODO: add reportUrl / triageUrl (pre-signed S3 links) once the worker writes reports
  return json(200, Item);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function error(statusCode, code, message) {
  return json(statusCode, { error: { code, message } });
}
