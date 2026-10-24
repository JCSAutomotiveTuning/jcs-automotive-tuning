
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.string().uuid(),
  path: z.string().min(1).max(500),
  fileName: z.string().min(1).max(180),
  fileSize: z.number().int().positive().max(16 * 1024 * 1024),
});

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
      { error: "Invalid completion request." },
      { status: 400 }
    );
  }

  const v = parsed.data;

  if (!v.path.startsWith(`${user.id}/${v.orderId}/`)) {
    return NextResponse.json(
      { error: "Upload path does not match your account." },
      { status: 403 }
    );
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", v.orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json(
      { error: "Order not found." },
      { status: 404 }
    );
  }

  const admin = createAdminClient();

  const fileName = v.path.split("/").pop();

  if (!fileName) {
    return NextResponse.json(
      { error: "Invalid storage path." },
      { status: 400 }
    );
  }

  const { data: obj, error: storageError } = await admin.storage
    .from("tuning-files")
    .list(`${user.id}/${v.orderId}`, {
      search: fileName,
      limit: 10,
    });

  if (storageError || !obj?.some((file) => file.name === fileName)) {
    return NextResponse.json(
      { error: "Uploaded object could not be verified." },
      { status: 400 }
    );
  }

  const { data: result, error } = await admin.rpc(
    "submit_file_with_wallet",
    {
      p_user_id: user.id,
      p_order_id: v.orderId,
      p_storage_path: v.path,
      p_original_filename: v.fileName,
      p_size_bytes: v.fileSize,
    }
  );

  if (error) {
    if (error.message.includes("Insufficient wallet balance")) {
      return NextResponse.json(
        { error: "Your wallet needs at least £20 to submit this file. Please top up first." },
        { status: 402 }
      );
    }

    if (error.message.includes("Order not found")) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    console.error("Wallet submission failed:", error);

    return NextResponse.json(
      { error: "Could not complete file submission. Please contact support if this continues." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    alreadySubmitted: result === "already_recorded",
    alreadyCharged: result === "already_charged",
  });
}
