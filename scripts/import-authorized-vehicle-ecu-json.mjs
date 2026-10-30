#!/usr/bin/env node
// Import curated/licensed vendor reference data. Never scrape or republish vendor databases without rights.
// Run: node scripts/import-authorized-vehicle-ecu-json.mjs records.json --dry-run
// Run: node scripts/import-authorized-vehicle-ecu-json.mjs records.json --apply
// Required for --apply: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side only).
import fs from "node:fs/promises";
const args=process.argv.slice(2);
const file=args.find(a=>a.endsWith(".json"));
const apply=args.includes("--apply");
if(!file || !(args.includes("--dry-run")||apply)){console.error("Usage: node scripts/import-authorized-vehicle-ecu-json.mjs records.json --dry-run|--apply");process.exit(2);}
function fail(i,why){throw Error(`Row ${i+1}: ${why}`);}
const input=JSON.parse(await fs.readFile(file,"utf8"));
if(!Array.isArray(input)||input.length===0||input.length>30000)throw Error("Expected JSON array of 1 to 30000 records");
const methods=new Set(["OBD","Bench","Boot","BDM"]);
const readKinds=new Set(["unknown","physical","virtual","no"]);
const writeKinds=new Set(["unknown","yes","no"]);
const grades=new Set(["historic_vendor_list","current_vendor_list","exact_hw_sw_verified"]);
const normalized=input.map((r,i)=>{
 if(!r||typeof r!=="object")fail(i,"invalid object");
 for(const k of ["make","model","ecu_family","tool_name","source_url","source_label","connection_method"]){if(typeof r[k]!=="string"||!r[k].trim())fail(i,k+" is required");}
 if(!methods.has(r.connection_method))fail(i,"connection_method must be OBD, Bench, Boot or BDM");
 const read=r.read_capability??"unknown",write=r.write_capability??"unknown",status=r.coverage_status??"historic_vendor_list";
 if(!readKinds.has(read)||!writeKinds.has(write)||!grades.has(status))fail(i,"invalid read, write or coverage status");
 if(status==="exact_hw_sw_verified"&&!r.exact_ecu_evidence)fail(i,"exact HW/SW verification must be reviewed manually, not imported automatically");
 const url=new URL(r.source_url);
 if(url.protocol!=="https:")fail(i,"https source URL required");
 if(r.source_url.length>500)fail(i,"source_url too long");
 for(const v of ["make","model","ecu_family","tool_name"]){if(r[v].length>90)fail(i,v+" too long");}
 const year=r.listed_year??null;
 if(year!==null&&(!Number.isInteger(year)||year<1980||year>2035))fail(i,"listed_year out of range");
 const code=typeof r.engine_code==="string"?r.engine_code.trim().slice(0,80):null;
 const key=[r.make,r.model,r.generation||"",code||r.engine_label||"",r.ecu_family,r.tool_name,r.connection_method].join("|").toLowerCase().replace(/[^a-z0-9|.+]/g,"").slice(0,240);
 if(!key)fail(i,"cannot create reference key");
 return {reference_key:key,make:r.make,model:r.model,generation:r.generation??null,engine_code:code,engine_label:r.engine_label??null,power_ps:r.power_ps??null,listed_year:year,ecu_manufacturer:r.ecu_manufacturer??null,ecu_family:r.ecu_family,tool_name:r.tool_name,connection_method:r.connection_method,read_capability:read,write_capability:write,coverage_status:status==="exact_hw_sw_verified"?"current_vendor_list":status,source_url:r.source_url,source_label:r.source_label,source_year:r.source_year??null};
});
if(new Set(normalized.map(x=>x.reference_key)).size!==normalized.length)throw Error("Duplicate application+tool+connection records in input");
console.log(`Validated ${normalized.length} records from ${new Set(normalized.map(x=>x.make)).size} makes. ${apply?"APPLY":"DRY RUN"}.`);
if(!apply)process.exit(0);
if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error("Server-side Supabase credentials are required for --apply");
const {createClient}=await import("@supabase/supabase-js");
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
for(let i=0;i<normalized.length;i+=100){const {error}=await db.from("vehicle_ecu_references").upsert(normalized.slice(i,i+100),{onConflict:"reference_key"});if(error)throw Error(`Batch at ${i}: ${error.message}`);console.log(`Applied ${Math.min(i+100,normalized.length)}/${normalized.length}`);}
