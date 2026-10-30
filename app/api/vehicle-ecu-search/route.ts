import {chargeSearch} from "@/lib/customer-search-quota";
import { NextRequest,NextResponse } from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {sourcedMatches} from "@/lib/sourced-tool-matches";
import {cleanVehicleSearch,pdAliases,vehicleSearchTokens} from "@/lib/vehicle-ecu-search";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const matchKeys=["make","model","generation","engine_code","engine_label","ecu_family","ecu_manufacturer","tool_name","ecu_hw_id","ecu_sw_id","tool_protocol","mcu"];
const legacyKeys=["make","model","engine_code","engine_description","ecu_family","ecu_part_number","ecu_hw_id","ecu_sw_id"];
// PostgREST .or() string syntax: allow safe search characters, not query operators/commas/wildcards.
const brands=["Audi","Volkswagen","SEAT","Skoda","BMW","Ford","Peugeot","Alfa Romeo","Abarth","Mercedes-Benz","Renault","Citroen","Opel","Fiat","Volvo","Hyundai","Nissan"];
export async function GET(req:NextRequest){
 const auth=await createClient();
 const {data:{user}}=await auth.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 const q=cleanVehicleSearch(req.nextUrl.searchParams.get("q")||"");
 const tokens=vehicleSearchTokens(q);
 const make=cleanVehicleSearch(req.nextUrl.searchParams.get("make")||"");
 const method=req.nextUrl.searchParams.get("method")||"all";
 const page=Number(req.nextUrl.searchParams.get("page")||"1");
 if(!Number.isSafeInteger(page)||page<1||page>500)return NextResponse.json({error:"Invalid page number"},{status:400});
 const pageSize=40;
 if(!["all","OBD","Bench","Boot","BDM"].includes(method))return NextResponse.json({error:"Invalid connection method"},{status:400});
 if(make&&!brands.some(b=>b.toLowerCase()===make.toLowerCase()))return NextResponse.json({error:"Unknown make filter"},{status:400});
 if(!q&&!make)return NextResponse.json({error:"Enter a vehicle, engine, ECU family or choose a make"},{status:400});
 const {blocked,quota}=await chargeSearch();
 if(blocked)return blocked;
 const db=createAdminClient();
 let referenceQuery=db.from("vehicle_ecu_references")
 .select("make,model,generation,engine_code,engine_label,power_ps,listed_year,ecu_manufacturer,ecu_family,tool_name,connection_method,read_capability,write_capability,coverage_status,source_url,source_label,source_year",{count:"exact"})
 .order("make").order("model").range((page-1)*pageSize,page*pageSize-1);
 if(pdAliases[q.toUpperCase()])referenceQuery=referenceQuery.or(pdAliases[q.toUpperCase()].map(code=>`engine_code.ilike.%${code}%`).join(","));
 else for(const token of tokens)referenceQuery=referenceQuery.or(matchKeys.map(k=>`${k}.ilike.%${token}%`).join(","));
 if(make)referenceQuery=referenceQuery.ilike("make",make);
 if(method!=="all")referenceQuery=referenceQuery.eq("connection_method",method);
 let legacyQuery=db.from("ecu_catalogue")
 .select("make,model,model_year_from,model_year_to,engine_code,engine_description,ecu_manufacturer,ecu_family,ecu_part_number,ecu_hw_id,ecu_sw_id,verified,source_url,verification_notes",{count:"exact"})
 .order("make").order("model").range((page-1)*pageSize,page*pageSize-1);
 if(pdAliases[q.toUpperCase()])legacyQuery=legacyQuery.or(pdAliases[q.toUpperCase()].map(code=>`engine_code.ilike.%${code}%`).join(","));
 else for(const token of tokens)legacyQuery=legacyQuery.or(legacyKeys.map(k=>`${k}.ilike.%${token}%`).join(","));
 if(make)legacyQuery=legacyQuery.ilike("make",make);
 const [reference,legacy]=await Promise.all([referenceQuery,legacyQuery]);
 if(reference.error){
  console.error("Vehicle ECU reference lookup failed",reference.error.code,reference.error.message);
  return NextResponse.json({error:"Verified-source vehicle search is temporarily unavailable."},{status:503});
 }
 if(legacy.error)console.error("Legacy ECU catalogue lookup failed",legacy.error.code,legacy.error.message);
 const refs=reference.data||[];
 const existing=legacy.data||[];
 const families=[...new Set([...refs.map(v=>v.ecu_family),...existing.map(v=>v.ecu_family)].filter(Boolean))].slice(0,15);
 const sourced=families.flatMap(f=>sourcedMatches(f));
 return NextResponse.json({
  quota,
  references:refs,
  candidateVehicles:existing,
  familyProtocolReferences:sourced,
  brands,
  count:refs.length+existing.length,
  totalCount:(reference.count||0)+(legacy.count||0),
  page,
  hasMore:(reference.count||0)>page*pageSize||(legacy.count||0)>page*pageSize,
  capped:false,
  disclaimer:"Vehicle-list connections are historic vendor listings, not proof of present-day support or physical ECU identification. Listed-year is a documented application year, not a full production range. Read/write fields are unknown unless individually confirmed. Select protocol in current manufacturer software and verify ECU HW/SW before flashing."
 },{headers:{"Cache-Control":"no-store"}});
}
