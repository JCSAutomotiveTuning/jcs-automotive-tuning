import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Sign in to search the ECU catalogue." }, { status: 401 });
  const make = (req.nextUrl.searchParams.get("make") ?? "").trim().slice(0,60);
  const model = (req.nextUrl.searchParams.get("model") ?? "").trim().slice(0,60);
  const engine = (req.nextUrl.searchParams.get("engine") ?? "").trim().slice(0,60);
  if (!make || !model || !engine) return NextResponse.json({ error: "Make, model and engine are required." }, { status: 400 });
  const { data, error: queryError } = await createAdminClient().from("ecu_catalogue")
    .select("make,model,model_year_from,model_year_to,engine_code,engine_description,ecu_manufacturer,ecu_family,ecu_part_number,stock_bhp,stock_torque_nm,stage1_bhp,stage1_torque_nm,egr_fitment,dpf_fitment,adblue_fitment,supported_tools,verified")
    .ilike("make", make).ilike("model", model).ilike("engine_code", engine).limit(10);
  if (queryError) return NextResponse.json({ error: "ECU catalogue temporarily unavailable." }, { status: 500 });
  return NextResponse.json({ matches: data ?? [], note: "Provisional records are reference data, not confirmed ECU identification. Confirm the actual ECU hardware and software ID before supplying a tuning file." }, { headers: { "Cache-Control": "private, no-store" } });
}
