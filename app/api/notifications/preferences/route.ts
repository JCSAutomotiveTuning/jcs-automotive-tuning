import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ emailEnabled: z.boolean(), smsEnabled: z.boolean() });
async function currentUser() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  return user;
}
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("notification_preferences")
    .select("email_enabled,sms_enabled,phone_e164,phone_verified_at")
    .eq("user_id",user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load preferences" }, { status: 500 });
  return NextResponse.json({ emailEnabled: data?.email_enabled ?? true,
    smsEnabled: data?.sms_enabled ?? false, phone: data?.phone_e164 ?? null,
    phoneVerified: Boolean(data?.phone_verified_at) });
}
export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(()=>null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid preferences" }, { status: 400 });
  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin.from("notification_preferences")
    .select("phone_verified_at").eq("user_id",user.id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Could not load preferences" }, { status: 500 });
  if (parsed.data.smsEnabled && !existing?.phone_verified_at)
    return NextResponse.json({ error: "Verify a mobile number before enabling SMS. SMS verification is not yet configured." }, { status: 400 });
  const { error } = await admin.from("notification_preferences").upsert({
    user_id:user.id,email_enabled:parsed.data.emailEnabled,
    sms_enabled:parsed.data.smsEnabled,updated_at:new Date().toISOString(),
  },{onConflict:"user_id"});
  if (error) return NextResponse.json({ error: "Could not save preferences" }, { status: 500 });
  return NextResponse.json({ ok:true });
}
