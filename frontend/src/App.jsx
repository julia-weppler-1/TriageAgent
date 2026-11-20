import { useEffect, useState } from "react";
import { USING_MOCK, createScan, getScan } from "./api.js";

export default function App() {
  const [type, setType] = useState("SAST");
  const [code, setCode] = useState("");
  const [targetUrl, setTargetUrl] = useState("http://test-target:4000/api/users");
  const [scanId, setScanId] = useState(null);
  const [scan, setScan] = useState(null);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setScan(null);
    try {
      const input = type === "SAST" ? { type, code } : { type, targetUrl };
      const result = await createScan(input);
      setScanId(result.scanId);
    } catch (err) {
      setError(err.message);
    }
  }

  // Check the scan every 2 seconds until it's finished
  useEffect(() => {
    if (!scanId) return;
    const timer = setInterval(async () => {
      try {
        const latest = await getScan(scanId);
        setScan(latest);
        const done = latest.scanStatus === "COMPLETED" && latest.triageStatus !== "PENDING";
        if (done || latest.scanStatus === "FAILED") {
          clearInterval(timer);
        }
      } catch (err) {
        setError(err.message);
        clearInterval(timer);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [scanId]);

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>TriageAgent</h1>
      <h2>Demo 1 - Julia Weppler</h2>
      {USING_MOCK && <p>Demo mode: using a fake API.</p>}

      <form onSubmit={submit}>
        <p>
          <label>
            Scan type:{" "}
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="SAST">Code (SAST)</option>
              <option value="PENTEST">Live API (Pentest)</option>
            </select>
          </label>
        </p>

        {type === "SAST" ? (
          <textarea
            rows={12}
            style={{ width: "100%" }}
            placeholder="Paste JavaScript here"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        ) : (
          <input style={{ width: "100%" }} value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} />
        )}

        <p>
          <button type="submit">Scan</button>
        </p>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {scanId && (
        <section>
          <h2>Scan {scanId}</h2>
          <p>Status: {scan ? scan.scanStatus : "QUEUED"}</p>
          {scan?.statusReason && <p>{scan.statusReason}</p>}

          {scan?.scanStatus === "COMPLETED" && (
            <>
              <p>
                Grade: <strong>{scan.grade}</strong> ({scan.score}/100)
              </p>
              <p>
                High: {scan.highCount} · Medium: {scan.mediumCount} · Low: {scan.lowCount}
              </p>
              <p>AI summary: {scan.triageStatus === "DONE" ? scan.aiSummaryShort : "not ready yet"}</p>
            </>
          )}
        </section>
      )}
    </main>
  );
}
