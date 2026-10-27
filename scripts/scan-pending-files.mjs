// JCS Automotive Tuning: trusted ClamAV worker (run on a secured PC/server).
// Never run this in a browser or expose the Supabase service-role key.
import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAX_BYTES = 16 * 1024 * 1024;
const SCANNER = process.env.CLAMSCAN_PATH || "clamscan";
const MAX_JOBS = 20;
const collections = [
  { table: "order_files", bucket: "tuning-files" },
  { table: "technical_request_files", bucket: "technical-deliverables" },
];

function scanFile(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      "--no-summary", "--infected", "--stdout",
      "--alert-encrypted=yes", "--alert-exceeds-max=yes",
      "--max-filesize=17M", "--max-scansize=128M", filePath,
    ];
    const child = spawn(SCANNER, args, { windowsHide: true, timeout: 120000 });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (signal || code === null) return reject(new Error("ClamAV timed out"));
      if (code === 0) return resolve("clean");
      if (code === 1) return resolve("blocked");
      return reject(new Error("ClamAV scan failed (engine or signatures)"));
    });
  });
}

async function scanBytes(bytes) {
  const directory = await mkdtemp(join(tmpdir(), "jcs-scan-"));
  const localFile = join(directory, "untrusted-upload");
  try {
    await writeFile(localFile, bytes, { mode: 0o600, flag: "wx" });
    return await scanFile(localFile);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function selfTest() {
  // Official EICAR benign antivirus test signature.
  const eicar = String.raw`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`;
  if (await scanBytes(Buffer.from(eicar, "ascii")) !== "blocked") {
    throw new Error("ClamAV failed EICAR self-test; do not scan production files");
  }
  console.log("PASS: ClamAV detected the EICAR test signature");
}

async function runWorker() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !/^https:\/\//.test(url) || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  // Fail closed before touching customer data if signatures/engine are unusable.
  await selfTest();
  const db = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let errors = 0, scanned = 0, blocked = 0;
  for (const { table, bucket } of collections) {
    const { data: rows, error: listError } = await db.from(table)
      .select("id,storage_path,size_bytes")
      .eq("scan_status", "pending")
      .order("created_at", { ascending: true })
      .limit(MAX_JOBS);
    if (listError) throw new Error("Unable to list pending files in " + table);
    for (const row of rows || []) {
      let status = "error", digest = null;
      try {
        if (!row.storage_path || typeof row.storage_path !== "string" ||
            !Number.isSafeInteger(Number(row.size_bytes)) ||
            Number(row.size_bytes) < 1 || Number(row.size_bytes) > MAX_BYTES) {
          status = "blocked";
        } else {
          const { data: blob, error: downloadError } = await db.storage
            .from(bucket).download(row.storage_path);
          if (downloadError || !blob) throw new Error("Private storage download failed");
          const bytes = Buffer.from(await blob.arrayBuffer());
          if (bytes.length !== Number(row.size_bytes)) {
            throw new Error("Storage size differs from database metadata");
          }
          digest = createHash("sha256").update(bytes).digest("hex");
          status = await scanBytes(bytes);
        }
      } catch (error) {
        console.error("Scan failed for " + table + " record " + row.id + ": " +
          (error instanceof Error ? error.message : "unknown"));
        errors++;
      }
      const { data: updated, error: updateError } = await db.from(table)
        .update({ scan_status: status, sha256: digest })
        .eq("id", row.id)
        .eq("scan_status", "pending")
        .select("id");
      if (updateError || !updated?.length) {
        errors++;
        console.error("Could not save scan result for " + table + " record " + row.id);
      } else {
        scanned++;
        if (status === "blocked") blocked++;
      }
    }
  }
  console.log(`JCS scan run: ${scanned} processed, ${blocked} blocked, ${errors} errors`);
  if (errors) process.exitCode = 1;
}

try {
  if (process.argv.includes("--self-test")) await selfTest();
  else await runWorker();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Scanner failed");
  process.exitCode = 1;
}
