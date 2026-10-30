/** Manufacturer-sourced historical capabilities. Verify current license, software, vehicle and HW/SW first. */
export type SourcedToolMatch={ecu_family:string;tool_name:string;method:string;protocol:string;verified:boolean;notes:string;source_url:string};
const sources:SourcedToolMatch[]=[
 ...["MED9.1","EDC16U1","EDC16U31","EDC16C34","EDC16CP31"].map(ecu_family=>({
  ecu_family,tool_name:"Alientech K-TAG",method:"Bench (Motorola Service Mode)",protocol:"Read and write",verified:true,
  notes:"Manufacturer announcement (2020): capability depends on supported vehicle/ECU application and licensed K-Suite release. Confirm exact ECU in current tool software.",
  source_url:"https://www.alientech-tools.com/en/k-suite-3-91/"
 })),
 ...["MED9.1","EDC16U1","EDC16U31","EDC16C1","EDC16C31","EDC16C34","EDC16C39"].map(ecu_family=>({
  ecu_family,tool_name:"AutoTuner",method:"Bench",protocol:"Real read and write",verified:true,
  notes:"Manufacturer-announced ECU-family capability. Exact vehicle, software revision and currently enabled functions must be checked in AutoTuner's live compatibility list.",
  source_url:"https://www.autotuner.com/blogs/news/bosch-edc16-med9-1"
 }))
];
export function sourcedMatches(family:string){const term=family.trim().toUpperCase().replace(/[^A-Z0-9.]/g,"");if(term.length<3)return [];return sources.filter(s=>s.ecu_family.toUpperCase()===term);}
