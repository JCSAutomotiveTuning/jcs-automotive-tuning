import { NextResponse } from "next/server";
import { webcrypto } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIENCE = "urn:jcs:scanner:production";
const ISSUER = "https://token.actions.githubusercontent.com";
const REPOSITORY = "JCSAutomotiveTuning/jcs-automotive-tuning";
const WORKFLOW_REF = `${REPOSITORY}/.github/workflows/malware-scan.yml@refs/heads/main`;
const ref = "refs/heads/main";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha256 = /^[a-f0-9]{64}$/;
const collections = {
  order_files: "tuning-files",
  technical_request_files: "technical-deliverables",
} as const;

type Collection = keyof typeof collections;
const noStore = { "Cache-Control": "no-store" };

async function verifyGithubJob(request: Request): Promise<boolean> {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ") || auth.length > 9000) return false;
  const jwt = auth.slice(7);
  const parts = jwt.split(".");
  if (parts.length !== 3 || parts.some((part) => !part || part.length > 8000)) return false;
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (header.alg !== "RS256" || typeof header.kid !== "string" || header.kid.length > 200) return false;
    const now = Math.floor(Date.now() / 1000);
    const checks: Record<string, boolean> = {
      issuer: claims.iss === ISSUER,
      audience: claims.aud === AUDIENCE,
      repository: claims.repository === REPOSITORY,
      ref: claims.ref === ref,
      workflow: claims.workflow_ref === WORKFLOW_REF,
      subject: claims.sub === `repo:${REPOSITORY}:ref:${ref}`,
      event: ["schedule", "workflow_dispatch", "push"].includes(claims.event_name),
      issuedAt: Number.isInteger(claims.iat) && claims.iat <= now + 30 && claims.iat >= now - 600,
      expiresAt: Number.isInteger(claims.exp) && claims.exp > now && claims.exp <= now + 630,
      notBefore: typeof claims.nbf !== "number" || claims.nbf <= now + 30,
    };
    const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
    if (failed.length) {
      console.warn("Scanner identity claims rejected (fields only):", failed.join(","));
      return false;
    }

    // Do not trust unsigned JWT data. Only keys published by GitHub's issuer are accepted.
    const response = await fetch("https://token.actions.githubusercontent.com/.well-known/jwks", {
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return false;
    const data = await response.json() as { keys?: Array<JsonWebKey & { kid?: string; alg?: string }> };
    const key = data.keys?.find((candidate) =>
      candidate.kid === header.kid && candidate.kty === "RSA" &&
      (!candidate.alg || candidate.alg === "RS256")
    );
    if (!key) { console.warn("Scanner identity key not found."); return false; }
    const publicKey = await webcrypto.subtle.importKey(
      "jwk", key, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false, ["verify"]
    );
    const verified = await webcrypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", publicKey,
      Buffer.from(parts[2], "base64url"),
      new TextEncoder().encode(parts[0] + "." + parts[1])
    );
    if (!verified) console.warn("Scanner identity signature failed.");
    return verified;
  } catch (error) {
    console.warn("Scanner identity verification exception:", error instanceof Error ? error.name : "unknown");
    return false;
  }
}

export async function POST(req: Request) {
  if (!(await verifyGithubJob(req))) {
    return NextResponse.json({ error: "Scanner identity verification failed." }, {
      status: 401, headers: noStore,
    });
  }

  if (Number(req.headers.get("content-length") || 0) > 2048) {
    return NextResponse.json({ error: "Invalid request." }, { status: 413, headers: noStore });
  }

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: noStore });
  }
  const b = body as Record<string, unknown>;
  if (!["list", "get", "result"].includes(String(b.action))) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400, headers: noStore });
  }
  const db = createAdminClient();

  if (b.action === "list") {
    const entries: { table: Collection; id: string; size_bytes: number }[] = [];
    for (const table of Object.keys(collections) as Collection[]) {
      const { data, error } = await db.from(table)
        .select("id,size_bytes")
        .eq("scan_status", "pending").order("created_at", { ascending: true }).limit(10);
      if (error) {
        console.error("Scanner list failed:", table, error.message);
        return NextResponse.json({ error: "Unable to list pending files." }, { status: 503, headers: noStore });
      }
      for (const file of data ?? []) entries.push({
        table, id: file.id, size_bytes: Number(file.size_bytes),
      });
    }
    return NextResponse.json({ entries }, { headers: noStore });
  }

  if (!(typeof b.table === "string" && Object.hasOwn(collections, b.table)) ||
      typeof b.id !== "string" || !uuid.test(b.id)) {
    return NextResponse.json({ error: "Invalid file reference." }, { status: 400, headers: noStore });
  }
  const table = b.table as Collection;

  if (b.action === "get") {
    const { data: row, error } = await db.from(table)
      .select("storage_path,size_bytes").eq("id", b.id).eq("scan_status", "pending").maybeSingle();
    if (error || !row) {
      return NextResponse.json({ error: "File is not pending." }, { status: 409, headers: noStore });
    }
    if (typeof row.storage_path !== "string" || !row.storage_path ||
        !Number.isSafeInteger(Number(row.size_bytes)) ||
        Number(row.size_bytes) < 1 || Number(row.size_bytes) > 16 * 1024 * 1024) {
      return NextResponse.json({ error: "Invalid stored file metadata." }, { status: 409, headers: noStore });
    }
    const { data, error: signError } = await db.storage
      .from(collections[table]).createSignedUrl(row.storage_path, 120);
    if (signError || !data?.signedUrl) {
      return NextResponse.json({ error: "Unable to sign scanner download." }, { status: 503, headers: noStore });
    }
    return NextResponse.json({ url: data.signedUrl, size_bytes: Number(row.size_bytes) }, { headers: noStore });
  }

  if (!["clean", "blocked", "error"].includes(String(b.status)) ||
      (b.digest !== null && b.digest !== undefined &&
       (typeof b.digest !== "string" || !sha256.test(b.digest))) ||
      (b.status === "clean" && typeof b.digest !== "string")) {
    return NextResponse.json({ error: "Invalid scan result." }, { status: 400, headers: noStore });
  }

  const { data: updated, error } = await db.from(table).update({
    scan_status: b.status,
    sha256: b.digest ?? null,
  }).eq("id", b.id).eq("scan_status", "pending").select("id");
  if (error || updated?.length !== 1) {
    return NextResponse.json({ error: "Scan result could not be saved." }, { status: 409, headers: noStore });
  }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
