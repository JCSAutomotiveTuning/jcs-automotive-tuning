import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 16 * 1024 * 1024;

const allowedExtensions = new Set([
  "bin", "ori", "hex", "frf", "odx",
  "txt", "csv", "log", "zip",
]);

const schema = z.object({
  orderId: z.string().uuid(),
  path: z.string().min(1).max(500),
  fileName: z.string().min(1).max(180),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
});

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Sign in required." },
      { status: 401 }
    );
  }

  const parsed = schema.safeParse(
    await req.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid completion request." },
      { status: 400 }
    );
  }

  const v = parsed.data;
  const prefix = `${user.id}/${v.orderId}/`;

  if (!v.path.startsWith(prefix)) {
    return NextResponse.json(
      { error: "Upload path does not match your account." },
      { status: 403 }
    );
  }

  const storedName = v.path.slice(prefix.length);

  // Only allow a file directly inside the customer's order folder.
  if (
    !storedName ||
    storedName.includes("/") ||
    storedName.includes("\\") ||
    storedName === "." ||
    storedName === ".."
  ) {
    return NextResponse.json(
      { error: "Invalid storage path." },
      { status: 400 }
    );
  }

  // Signed uploads use a UUID prefix followed by the filename.
  const match = storedName.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i
  );

  if (!match) {
    return NextResponse.json(
      { error: "Invalid uploaded filename." },
      { status: 400 }
    );
  }

  const extension = match[1].split(".").pop()?.toLowerCase();

  if (!extension || !allowedExtensions.has(extension)) {
    return NextResponse.json(
      { error: "Unsupported ECU/TCU file type." },
      { status: 400 }
    );
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id")
    .eq("id", v.orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (orderError) {
    console.error("Order lookup failed:", orderError);

    return NextResponse.json(
      { error: "Could not verify order." },
      { status: 500 }
    );
  }

  if (!order) {
    return NextResponse.json(
      { error: "Order not found." },
      { status: 404 }
    );
  }

  const admin = createAdminClient();

  const { data: objects, error: storageError } =
    await admin.storage
      .from("tuning-files")
      .list(`${user.id}/${v.orderId}`, {
        search: storedName,
        limit: 100,
      });

  if (storageError) {
    console.error("Storage verification failed:", storageError);

    return NextResponse.json(
      { error: "Could not verify uploaded file." },
      { status: 500 }
    );
  }

  const object = objects?.find(
    (item) => item.name === storedName
  );

  if (!object || !object.id || !object.metadata) {
    return NextResponse.json(
      { error: "Uploaded object could not be verified." },
      { status: 400 }
    );
  }

  const actualSize = Number(object.metadata.size);

  if (
    !Number.isSafeInteger(actualSize) ||
    actualSize <= 0 ||
    actualSize > MAX_FILE_SIZE
  ) {
    return NextResponse.json(
      { error: "Stored file size is invalid or exceeds 16 MB." },
      { status: 400 }
    );
  }

  if (actualSize !== v.fileSize) {
    return NextResponse.json(
      { error: "Uploaded file size does not match the stored file." },
      { status: 400 }
    );
  }

  const { data: result, error: submissionError } =
    await admin.rpc("submit_file_with_wallet", {
      p_user_id: user.id,
      p_order_id: v.orderId,
      p_storage_path: v.path,
      p_original_filename: v.fileName,
      p_size_bytes: actualSize,
    });

  if (submissionError) {
    if (
      submissionError.message.includes(
        "Insufficient wallet balance"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Insufficient wallet balance for the £20 file submission fee. Please top up your wallet.",
        },
        { status: 402 }
      );
    }

    if (submissionError.message.includes("Order not found")) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (
      submissionError.message.includes(
        "Order not accepting uploads"
      )
    ) {
      return NextResponse.json(
        { error: "This order is not accepting uploads." },
        { status: 409 }
      );
    }

    console.error(
      "Wallet submission failed:",
      submissionError
    );

    return NextResponse.json(
      {
        error:
          "Could not complete file submission. Please contact support if this continues.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    alreadySubmitted: result === "already_recorded",
    alreadyCharged: result === "already_charged",
  });
}
