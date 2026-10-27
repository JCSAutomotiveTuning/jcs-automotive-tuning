// JCS local ClamAV worker. Run from Windows with scripts/start-scan-worker.ps1.
// A valid Supabase ADMIN account is required. No service-role key is used on this machine.
// Uploaded files remain untrusted and unavailable for download until the scanner reports clean.
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

if (existsSync(".env.local") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(resolve(".env.local"));
}

const portal = (process.env.JCS_SCAN_PORTAL_URL || "https://jcs-automotive-tuning.vercel.app").replace(/\/+$/, "");
const supabaseUrl = process.env.JCS_SCAN_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.JCS_SCAN_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.JCS_SCAN_EMAIL;
const password = process.env.JCS_SCAN_PASSWORD;
const clamscan = process.env.JCS_CLAMSCAN_PATH || "clamscan";
const expectedProject = "tpvsebxdrluadefhboez";

if (!portal.startsWith("https://") || !supabaseUrl ||
    new URL(supabaseUrl).hostname !== expectedProject + ".supabase.co" ||
    !anonKey || !email || !password) {
  console.error("Scanner configuration missing or not pointing at JCS production Supabase. See scripts/SCANNER_SETUP.md.");
  process.exit(1);
}

const client = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
let session = null;
async function authToken() {
  const now = Math.floor(Date.now() / 1000);
  if (session?.expires_at && session.expires_at > now + 120) return session.access_token;
  if (session?.refresh_token) {
    const renewed = await client.auth.refreshSession({ refresh_token: session.refresh_token });
    if (!renewed.error && renewed.data.session) {
      session = renewed.data.session;
      return session.access_token;
    }
  }
  const loggedIn = await client.auth.signInWithPassword({ email, password });
  if (loggedIn.error || !loggedIn.data.session) {
    throw new Error("Scanner admin sign-in failed. Check credentials, MFA and account role.");
  }
  session = loggedIn.data.session;
  return session.access_token;
}

async function api(method, body) {
  const token = await authToken();
  const result = await fetch(portal + "/api/admin/scan-queue", {
    method,
    headers: {
      Authorization: "Bearer " + token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  const json = await result.json().catch(() => null);
  if (!result.ok) throw new Error("Scanner API returned HTTP " + result.status + ": " + (json?.error || "Unknown error"));
  return json;
}


const CLAM_OPTIONS = [
  "--stdout", "--alert-encrypted=yes", "--alert-exceeds-max=yes",
  "--max-filesize=17M", "--max-scansize=128M",
];
// Do not expose the admin password or other application secrets to ClamAV.
const engineEnv = Object.fromEntries([
  "PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE",
  "APPDATA", "LOCALAPPDATA", "ProgramData", "LD_LIBRARY_PATH",
].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));

function scanLocal(path) {
  const result = spawnSync(clamscan, [...CLAM_OPTIONS, path], {
    encoding: "utf8", windowsHide: true, timeout: 180000,
    maxBuffer: 1024 * 1024, env: engineEnv,
  });
  const summary = [result.stdout || "", result.stderr || ""].join("\n");
  const signatures = Number(summary.match(/Known viruses:\s*(\d+)/i)?.[1] || 0);
  if (result.error || signatures < 1 || !/Scanned files:\s*[1-9]/i.test(summary)) return "error";
  if (result.status === 0 && /Infected files:\s*0/i.test(summary)) return "clean";
  if (result.status === 1 && /Infected files:\s*[1-9]/i.test(summary)) return "blocked";
  return "error";
}

async function selfTest() {
  const temporary = join(tmpdir(), "jcs-clamav-eicar-" + randomUUID());
  const marker = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
  await writeFile(temporary, Buffer.from(marker, "ascii"), { flag: "wx", mode: 0o600 });
  try {
    if (scanLocal(temporary) !== "blocked") {
      throw new Error("ClamAV EICAR self-test failed. Scanner will not process customer files.");
    }
  } finally {
    await unlink(temporary).catch(() => {});
  }
  console.log("PASS: ClamAV EICAR self-test");
}

async function scanFile(file, signedUrl) {
  const name = join(tmpdir(), "jcs-clamav-" + randomUUID() + ".scan");
  try {
    const r = await fetch(signedUrl, { signal: AbortSignal.timeout(90000), cache: "no-store" });
    if (!r.ok) throw new Error("Signed file download failed (HTTP " + r.status + ")");
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length !== file.sizeBytes || bytes.length === 0 || bytes.length > 16 * 1024 * 1024) {
      throw new Error("Downloaded file size does not match database metadata");
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    await writeFile(name, bytes, { flag: "wx", mode: 0o600 });
    const verdict = scanLocal(name);
    // Scanner errors or missing signature databases NEVER result in a clean verdict.
    await api("POST", { fileId: file.id, kind: file.kind, verdict, sha256 });
    console.log(new Date().toISOString(), file.kind, file.id.slice(0, 8), verdict);
  } finally {
    await unlink(name).catch(() => {});
  }
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

await selfTest();
console.log("JCS authenticated ClamAV worker starting; updates require an active production admin session.");
while (true) {
  try {
    const next = await api("GET");
    if (next.file) await scanFile(next.file, next.signedUrl);
    else await sleep(20000);
  } catch (err) {
    console.error(new Date().toISOString(), "Scanner issue:", err instanceof Error ? err.message : String(err));
    await sleep(30000);
  }
}
