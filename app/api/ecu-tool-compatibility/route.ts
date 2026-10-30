import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toolDirectoryForFamily } from "@/lib/ecu-tool-directory";
import { sourcedMatches } from "@/lib/sourced-tool-matches";
import { lookupPdEngine, pdEngineWarning } from "@/lib/vag-pd-engines";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const family = (req.nextUrl.searchParams.get("family") || "").trim().slice(0, 80);
  const safe = family.replace(/[%,_\\]/g, "");
  if (!safe) return NextResponse.json({ error: "Enter ECU family" }, { status: 400 });

  const admin = createAdminClient();
  const [tools, vehicles] = await Promise.all([
    admin.from("ecu_tool_compatibility")
      .select("ecu_family,tool_name,method,protocol,verified,source_url,notes")
      .ilike("ecu_family", safe).limit(100),
    admin.from("ecu_catalogue")
      .select("make,model,engine_code,ecu_family,ecu_manufacturer,verified")
      .ilike("ecu_family", `%${safe}%`).limit(20)
  ]);
  if (tools.error) console.error("Tool compatibility database lookup:", tools.error.message);
  if (vehicles.error) console.error("ECU catalogue lookup:", vehicles.error.message);
  const engineMatches = lookupPdEngine(safe);
  const resolvedFamily = engineMatches.length ? "EDC15P+" : safe;
  const reference = toolDirectoryForFamily(resolvedFamily);
  return NextResponse.json({
    matches: [...(tools.data || []), ...sourcedMatches(resolvedFamily)],
    engineMatches,
    engineWarning: pdEngineWarning(safe),
    directory: reference.entries,
    familyRecognised: reference.familyRecognised,
    vehicleReferences: vehicles.data || [],
    note: "Vehicle/ECU family matches are not proof of tool compatibility. Confirm ECU HW/SW and tool protocol against official support lists."
  });
}
