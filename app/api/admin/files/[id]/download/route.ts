
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Please sign in first." },
      { status: 401 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: file, error: fileError } = await admin
    .from("order_files")
    .select("id,storage_path,original_filename,scan_status")
    .eq("id", id)
    .maybeSingle();

  if (fileError) {
    console.error("Admin file lookup failed:", fileError.message);
    return NextResponse.json(
      { error: "Could not look up this file." },
      { status: 500 }
    );
  }

  if (!file) {
    return NextResponse.json(
      { error: "File not found." },
      { status: 404 }
    );
  }

  if (file.scan_status !== "clean") {
    return NextResponse.json(
      { error: "This file has not passed safety validation." },
      { status: 409 }
    );
  }

  const { data, error } = await admin.storage
    .from("tuning-files")
    .createSignedUrl(file.storage_path, 60, {
      download: file.original_filename,
    });

  if (error || !data?.signedUrl) {
    console.error("Signed download creation failed:", error?.message);
    return NextResponse.json(
      { error: "Could not create a download link." },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: data.signedUrl });
}
