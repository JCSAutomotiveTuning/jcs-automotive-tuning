// JCS local ClamAV worker. Run from Windows with scripts/start-scan-worker.ps1.
// A valid Supabase ADMIN account is required. No service-role key is used on this machine.
// Uploaded files remain untrusted and unavailable for download until the scanner reports clean.
import { createClient } from "@supabase/supabase-js";
import { createConnection } from "node:net";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

if (existsSync(".env.local") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(resolve(".env.local"));
}

const portal = (process.env.JCS_SCAN_PORTAL_URL || "https://jcs-automotive-tuning.vercel.app").replace(/\/+$/, "");
const supabaseUrl = process.env.JCS_SCAN_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.JCS_SCAN_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.JCS_SCAN_EMAIL;
const password = process.env.JCS_SCAN_PASSWORD;
const clamHost = "127.0.0.1";
const clamPort = 3310;
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


// Use local clamd INSTREAM: never write untrusted content or EICAR to disk.
// Only a complete, explicitly clean reply is allowed to release a file.
function scanBytes(bytes) {
  return new Promise((resolveScan) => {
    if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > 16 * 1024 * 1024) {
      resolveScan("error");
      return;
    }
    const socket = createConnection({ host: clamHost, port: clamPort });
    let settled = false;
    let response = "";
    const finish = (verdict) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolveScan(verdict);
    };
    socket.setTimeout(45000, () => finish("error"));
    socket.on("error", () => finish("error"));
    socket.on("close", () => { if (!settled) finish("error"); });
    socket.on("data", (data) => {
      response += data.toString("utf8");
      if (response.length > 4096) return finish("error");
      const terminator = response.indexOf("\0");
      if (terminator < 0) return;
      const line = response.slice(0, terminator);
      if (terminator !== response.length - 1) return finish("error");
      if (/^stream: .+ FOUND$/.test(line)) return finish("blocked");
      if (line === "stream: OK") return finish("clean");
      return finish("error");
    });
    socket.on("connect", () => {
      const command = Buffer.from("zINSTREAM\0", "ascii");
      const length = Buffer.alloc(4);
      length.writeUInt32BE(bytes.length);
      const end = Buffer.alloc(4);
      socket.write(command);
      socket.write(length);
      socket.write(bytes);
      socket.write(end);
    });
  });
}

async function selfTest() {
  const marker = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
  if (await scanBytes(Buffer.from(marker, "ascii")) !== "blocked") {
    throw new Error("ClamAV EICAR INSTREAM self-test failed. Scanner will not process customer files.");
  }
  if (await scanBytes(Buffer.from("JCS clean scan startup verification", "utf8")) !== "clean") {
    throw new Error("ClamAV clean INSTREAM self-test failed. Scanner will not process customer files.");
  }
  console.log("PASS: ClamAV INSTREAM EICAR and clean-file self-tests");
}

async function scanFile(file, signedUrl) {
  const r = await fetch(signedUrl, { signal: AbortSignal.timeout(90000), cache: "no-store" });
  if (!r.ok) throw new Error("Signed file download failed (HTTP " + r.status + ")");
  const size = Number(r.headers.get("content-length"));
  if (Number.isFinite(size) && size > 16 * 1024 * 1024) {
    throw new Error("Downloaded file exceeds 16 MB");
  }
  const bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.length !== file.sizeBytes || bytes.length === 0 || bytes.length > 16 * 1024 * 1024) {
    throw new Error("Downloaded file size does not match database metadata");
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const verdict = await scanBytes(bytes);
  // Any malformed reply, timeout or daemon failure is recorded as error, never clean.
  await api("POST", { fileId: file.id, kind: file.kind, verdict, sha256 });
  console.log(new Date().toISOString(), file.kind, file.id.slice(0, 8), verdict);
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
