
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
  const ext = v.fileName.split(".").pop()?.toLowerCase() || "";

  if (!allowed.has(ext)) {
    return NextResponse.json(
      { error: "This file extension is not accepted." },
      { status: 400 }
    );
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

  const { data: wallet, error: walletError } = await admin
    .from("customer_wallets")
    .select("balance_pence")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: previousCharge, error: chargeError } = await admin
    .from("wallet_transactions")
    .select("id")
    .eq("user_id", user.id)
    .eq("order_id", v.orderId)
    .eq("transaction_type", "submission")
    .maybeSingle();

  if (walletError || chargeError) {
    console.error("Wallet pre-check failed:", walletError || chargeError);
    return NextResponse.json(
      { error: "Could not verify your wallet. Please try again." },
      { status: 500 }
    );
  }

  if (!previousCharge) {
    if (order.payment_status !== "unpaid") {
      return NextResponse.json(
        { error: "This order is already paid or has a payment in progress." },
        { status: 409 }
      );
    }

    if (!Number.isSafeInteger(order.amount_pence) || order.amount_pence <= 0) {
      return NextResponse.json(
        { error: "This order requires price confirmation before upload." },
        { status: 409 }
      );
    }

    // submit_file_with_wallet charges a fixed £20 submission fee, not the
    // quoted service price. Keep the pre-check aligned with the RPC.
    const submissionFeePence = 2000;
    if (!wallet || wallet.balance_pence < submissionFeePence) {
      const required = (submissionFeePence / 100).toFixed(2);
      const available = ((wallet?.balance_pence ?? 0) / 100).toFixed(2);

      return NextResponse.json(
        {
          error: `Insufficient wallet credit. Submission fee: GBP ${required}; available: GBP ${available}. Please top up first.`
        },
        { status: 402 }
      );
    }
  }

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
