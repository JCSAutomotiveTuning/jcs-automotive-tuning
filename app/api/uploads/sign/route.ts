
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.string().uuid(),
  fileName: z.string().min(1).max(180),
  fileSize: z.number().int().positive().max(16 * 1024 * 1024),
  contentType: z.string().max(120),
});

const allowed = new Set([
  "bin", "ori", "hex", "frf", "odx", "txt", "csv", "log", "zip",
]);

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in required." },
      { status: 401 }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid upload details. Maximum file size is 16 MB." },
      { status: 400 }
    );
  }

  const v = parsed.data;
  // Reject path tricks, control characters and misleading executable suffix chains.
  if (/[\\/\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(v.fileName) ||
      /\.(exe|dll|js|bat|cmd|ps1|vbs|scr|msi|com)\./i.test(v.fileName)) {
    return NextResponse.json({ error: "Unsafe filename." }, { status: 400 });
  }
  const ext = v.fileName.split(".").pop()?.toLowerCase() || "";

  if (!allowed.has(ext)) {
    return NextResponse.json(
      { error: "This file extension is not accepted." },
      { status: 400 }
    );
  }

  // Restrict upload links to the application origin, not cross-site form submissions.
  const origin = req.headers.get("origin");
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (origin && configuredOrigin) {
    try {
      if (new URL(origin).origin !== new URL(configuredOrigin).origin) {
        return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id,status,amount_pence,payment_status")
    .eq("id", v.orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json(
      { error: "Order not found." },
      { status: 404 }
    );
  }

  if (order.status !== "awaiting_review") {
    return NextResponse.json(
      { error: "This order is not accepting uploads." },
      { status: 409 }
    );
  }

  const admin = createAdminClient();

  // File submission is included in the order's service price.
  // Do not charge or require wallet credit for an upload.
  if (order.payment_status !== "unpaid" && order.payment_status !== "paid") {
    return NextResponse.json(
      { error: "This order's payment requires review before upload." },
      { status: 409 }
    );
  }

  // Coarse per-account upload-signing throttle; fail closed if audit storage is unavailable.
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count, error: limitError } = await admin.from("upload_security_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id).gte("created_at", since);
  if (limitError) return NextResponse.json({ error: "Upload security check unavailable." }, { status: 503 });
  if ((count ?? 0) >= 12) return NextResponse.json({ error: "Upload rate limit reached. Try again in 10 minutes." }, { status: 429 });
  const { error: eventError } = await admin.from("upload_security_events").insert({ user_id: user.id, order_id: v.orderId });
  if (eventError) return NextResponse.json({ error: "Unable to record upload attempt." }, { status: 503 });

  const path = `${user.id}/${v.orderId}/${crypto.randomUUID()}-${v.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { data, error } = await admin.storage
    .from("tuning-files")
    .createSignedUploadUrl(path, { upsert: false });

  if (error || !data) {
    return NextResponse.json(
      { error: "Could not create secure upload link. Confirm the private bucket exists." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    path,
    token: data.token,
  });
}
