// JCS cloud scanner: GitHub Actions OIDC -> restricted production scanner API.
// No Supabase service-role credentials are ever stored in GitHub Actions.
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const AUDIENCE = "urn:jcs:scanner:production";
const API = "https://jcs-automotive-tuning.vercel.app/api/internal/scanner";
const MAX_BYTES = 16 * 1024 * 1024;
const EICAR = String.raw`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`;

async function scanBytes(buffer) {
  const dir = await mkdtemp(join(tmpdir(), "jcs-cloud-scan-"));
  const path = join(dir, "untrusted-upload");
  try {
    await writeFile(path, buffer, { mode: 0o600, flag: "wx" });
    return await new Promise((resolve, reject) => {
      const child = spawn("clamscan", [
        "--no-summary", "--infected",
        "--alert-encrypted=yes", "--alert-exceeds-max=yes",
        "--max-filesize=17M", "--max-scansize=128M", path,
      ], { timeout: 120000, windowsHide: true });
      child.once("error", reject);
      child.once("close", (code, signal) => {
        if (signal || code === null) reject(new Error("ClamAV timed out or terminated"));
        else if (code === 0) resolve("clean");
        else if (code === 1) resolve("blocked");
        else reject(new Error("ClamAV engine/signatures failed"));
      });
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function verifyScanner() {
  if (await scanBytes(Buffer.from(EICAR, "ascii")) !== "blocked") {
    throw new Error("EICAR signature not detected. Scanner is not safe to use.");
  }
  if (await scanBytes(Buffer.from("Harmless JCS ClamAV clean test", "utf8")) !== "clean") {
    throw new Error("Clean file self-test failed.");
  }
  console.log("PASS: EICAR is blocked and harmless test file is clean.");
}

async function fetchIdentity() {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!requestUrl || !requestToken || process.env.GITHUB_ACTIONS !== "true") {
    throw new Error("Run the scanner from the authorised GitHub Actions workflow.");
  }
  const endpoint = new URL(requestUrl);
  if (endpoint.protocol !== "https:") throw new Error("Invalid GitHub identity endpoint");
  endpoint.searchParams.set("audience", AUDIENCE);
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${requestToken}` },
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`GitHub identity request failed: ${response.status}`);
  const data = await response.json();
  if (!data.value || typeof data.value !== "string") throw new Error("No GitHub identity token");
  // Print only boolean diagnostics; never log bearer tokens or customer identifiers.
  const claims = JSON.parse(Buffer.from(data.value.split(".")[1], "base64url").toString("utf8"));
  console.log("OIDC identity claims:", JSON.stringify({
    issuerMatches: claims.iss === "https://token.actions.githubusercontent.com",
    audienceMatches: claims.aud === AUDIENCE,
    repositoryMatches: claims.repository === "JCSAutomotiveTuning/jcs-automotive-tuning",
    refMatches: claims.ref === "refs/heads/main",
    workflowMatches: claims.workflow_ref === "JCSAutomotiveTuning/jcs-automotive-tuning/.github/workflows/malware-scan.yml@refs/heads/main",
    subjectMatches: claims.sub === "repo:JCSAutomotiveTuning/jcs-automotive-tuning:ref:refs/heads/main",
    eventAccepted: ["schedule", "workflow_dispatch", "push"].includes(claims.event_name),
  }));
  return data.value;
}

async function callApi(token, body) {
  const response = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(`Scanner API ${String(body.action)} failed (HTTP ${response.status}): ${typeof detail?.error === "string" ? detail.error : "unavailable"}`);
  }
  return response.json();
}

async function main() {
  // Scan only with a functioning, updated AV engine. No customer data used in the self-test.
  await verifyScanner();
  if (process.argv.includes("--self-test")) return;
  let token = await fetchIdentity();
  let lastTokenAt = Date.now();
  const api = async (body) => {
    if (Date.now() - lastTokenAt > 120_000) {
      token = await fetchIdentity();
      lastTokenAt = Date.now();
    }
    return callApi(token, body);
  };
  const { entries } = await api({ action: "list" });
  if (!Array.isArray(entries) || entries.length > 20) throw new Error("Invalid pending-file list");
  let clean = 0, blocked = 0, errors = 0;
  for (const file of entries) {
    let status = "error", digest = null;
    try {
      const metadata = await api({ action: "get", table: file.table, id: file.id });
      if (!Number.isSafeInteger(metadata.size_bytes) || metadata.size_bytes < 1 ||
          metadata.size_bytes > MAX_BYTES || metadata.size_bytes !== file.size_bytes) {
        status = "blocked";
      } else {
        const url = new URL(metadata.url);
        if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
          throw new Error("Invalid signed storage URL");
        }
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(60000) });
        if (!response.ok) throw new Error(`Download failed HTTP ${response.status}`);
        const length = Number(response.headers.get("content-length") || 0);
        if (length > MAX_BYTES) throw new Error("Object exceeds maximum size");
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length !== metadata.size_bytes) throw new Error("Stored size differs from recorded size");
        digest = createHash("sha256").update(bytes).digest("hex");
        status = await scanBytes(bytes);
      }
    } catch (error) {
      console.error("Failed to scan", String(file.table), String(file.id),
        error instanceof Error ? error.message : "unknown");
      errors++;
    }
    try {
      await api({ action: "result", table: file.table, id: file.id, status, digest });
      if (status === "clean") clean++;
      else if (status === "blocked") blocked++;
    } catch (error) {
      errors++;
      console.error("Failed to store scan result", String(file.id),
        error instanceof Error ? error.message : "unknown");
    }
  }
  console.log(`JCS ClamAV complete: ${clean} clean, ${blocked} blocked, ${errors} errors.`);
  if (errors) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
