// First version of the triage-worker: sends scan findings to the LLM and prints the triage.
// Later this will read jobs from the SQS triage-jobs queue instead of a file.

import { readFile } from "node:fs/promises";

const API_URL = "https://api.tokenfactory.nebius.com/v1/chat/completions";
const MODEL = process.env.TRIAGE_MODEL || "Qwen/Qwen3-30B-A3B-Instruct-2507";
const API_KEY = process.env.NEBIUS_API_KEY;

const SYSTEM_PROMPT = `You are a security triage assistant.
For each finding, decide if it is a real risk or a likely false positive,
explain why in one sentence, and suggest a fix.
Reply with JSON only, in this shape:
{"results":[{"id":"...","verdict":"real" or "likely_false_positive","reason":"...","fix":"..."}]}`;

async function triage(findings) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(findings) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM call failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const { results } = JSON.parse(data.choices[0].message.content);

  // The AI only adds an explanation. Severity always comes from the scanner,
  // so the AI can never hide a HIGH finding.
  return findings.map((f) => {
    const ai = results.find((r) => r.id === f.id) || {};
    return { ...f, verdict: ai.verdict ?? "unknown", reason: ai.reason ?? "", fix: ai.fix ?? "" };
  });
}

if (!API_KEY) {
  console.error("Set NEBIUS_API_KEY first");
  process.exit(1);
}

const file = process.argv[2] || "sample-findings.json";
const findings = JSON.parse(await readFile(file, "utf8"));
const triaged = await triage(findings);

console.log(JSON.stringify(triaged, null, 2));
console.log(`HIGH findings: ${triaged.filter((f) => f.severity === "HIGH").length}`);