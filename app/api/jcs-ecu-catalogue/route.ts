import {chargeSearch} from "@/lib/customer-search-quota";
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
  if (!make || !model) return NextResponse.json({ error: "Make and model are required." }, { status: 400 });
  const safe = (s: string) => s.replace(/[%,_\\]/g, "").trim();
  let query = createAdminClient().from("ecu_catalogue")
    .select("make,model,model_year_from,model_year_to,engine_code,engine_description,ecu_manufacturer,ecu_family,ecu_part_number,ecu_hw_id,ecu_sw_id,stock_bhp,stock_torque_nm,stage1_bhp,stage1_torque_nm,egr_fitment,dpf_fitment,adblue_fitment,supported_tools,verified,verification_notes,source_url")
    .ilike("make", safe(make)).ilike("model", safe(model))
    .order("engine_code", { ascending: true }).limit(100);
  if (engine) query = query.ilike("engine_code", safe(engine));
  const { data, error: queryError } = await query;
  if (queryError) return NextResponse.json({ error: "ECU catalogue temporarily unavailable." }, { status: 500 });
  const {blocked,quota}=await chargeSearch();
  if(blocked)return blocked;
  return NextResponse.json({ quota, matches: data ?? [], note: "Provisional records are reference data, not confirmed ECU identification. Confirm the actual ECU hardware and software ID before supplying a tuning file." }, { headers: { "Cache-Control": "private, no-store" } });
}
