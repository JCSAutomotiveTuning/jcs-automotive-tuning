import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
const base = "https://vpic.nhtsa.dot.gov/api/vehicles/";
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({error:"Sign in required."},{status:401});
  const step = req.nextUrl.searchParams.get("step");
  const make = (req.nextUrl.searchParams.get("make")||"").trim();
  const year = Number(req.nextUrl.searchParams.get("year"));
  if (step !== "makes" && step !== "models") return NextResponse.json({error:"Invalid search step."},{status:400});
  if (step==="models" && (!/^[a-zA-Z0-9 .&'-]{1,70}$/.test(make) || !Number.isInteger(year) || year<1981 || year>new Date().getUTCFullYear()+2)) return NextResponse.json({error:"Select a make and valid year."},{status:400});
  const url = step==="makes" ? base+"GetAllMakes?format=json" : base+"GetModelsForMakeYear/make/"+encodeURIComponent(make)+"/modelyear/"+year+"?format=json";
  try {
    const response=await fetch(url,{next:{revalidate:86400},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error("Provider error");
    const data=await response.json() as {Results?:Record<string,unknown>[]};
    const results=(data.Results||[]).map(item=>step==="makes"?String(item.Make_Name||""):String(item.Model_Name||"")).filter(Boolean);
    return NextResponse.json({items:[...new Set(results)].sort((a,b)=>a.localeCompare(b)),source:"NHTSA vPIC",note:"Vehicle listing does not confirm UK availability, engine variant or ECU."});
  } catch {return NextResponse.json({error:"Vehicle directory temporarily unavailable."},{status:502});}
}
