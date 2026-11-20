// Calls the TriageAgent API. When VITE_API_URL isn't set, a fake API
// is used instead so the page works before the real API is deployed.

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
export const USING_MOCK = API_URL === "";

async function request(method, path, body) {
  const res = await fetch(API_URL + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Request failed (${res.status})`);
  return data;
}

// POST /scans { scanId, scanStatus }
export function createScan(input) {
  return USING_MOCK ? mockCreate(input) : request("POST", "/scans", input);
}

// GET /scans/{scanId}
export function getScan(scanId) {
  return USING_MOCK ? mockGet(scanId) : request("GET", `/scans/${scanId}`);
}

// fake API, this was created with the help of Claude for demo purposes (11/19)
const mockScans = {};

async function mockCreate(input) {
  if (input.type === "PENTEST" && !input.targetUrl.startsWith("http://test-target:4000/")) {
    throw new Error("This URL is not on the allowlist.");
  }
  const scanId = "scn_mock_" + Date.now();
  mockScans[scanId] = { scanId, type: input.type, createdAt: Date.now() };
  return { scanId, scanStatus: "QUEUED" };
}

async function mockGet(scanId) {
  const scan = mockScans[scanId];
  const age = Date.now() - scan.createdAt;
  if (age < 2000) return { ...scan, scanStatus: "QUEUED" };
  if (age < 6000) return { ...scan, scanStatus: "RUNNING" };
  return {
    ...scan,
    scanStatus: "COMPLETED",
    score: 40,
    grade: "F",
    highCount: 2,
    mediumCount: 1,
    lowCount: 0,
    triageStatus: "DONE",
    aiSummaryShort: "Fake result: hardcoded password on line 3. Move it to an environment variable.",
  };
}
