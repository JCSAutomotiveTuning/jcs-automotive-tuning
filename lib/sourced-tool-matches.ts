/** Manufacturer-sourced historical capabilities. Verify current license, software, vehicle and HW/SW first. */
export type SourcedToolMatch={ecu_family:string;tool_name:string;method:string;protocol:string;verified:boolean;notes:string;source_url:string};
const sources:SourcedToolMatch[]=[
 {
  ecu_family:"EDC15P+",tool_name:"Magic Motorsport FLEX",method:"OBD",
  protocol:"Vehicle-listed OBD programming; confirm read/write operations in FLEX software",
  verified:false,
  notes:"Published FLEX vehicle list includes Seat Ibiza Cupra 1.9 TDI BPX and BUK with Bosch EDC15P+ via OBD. Connection-mode listing alone does not confirm read/write or your ECU revision.",
  source_url:"https://www.laytonecuremaps.co.uk/wp-content/uploads/2016/10/FLEX-FULL-vehicle-list-2020-11-9.pdf"
 },
 {
  ecu_family:"EDC15P+",tool_name:"Alientech KESS V2",method:"OBD",
  protocol:"EDC15P family protocol; exact vehicle read/write functions must be checked",
  verified:false,
  notes:"KESSv2 is an OBD read/write platform. Historical VAG EDC15P protocols are documented, but this does not verify a particular AXR, ASZ, BLT, ARL, BPX or BUK ECU, tool firmware or clone.",
  source_url:"https://www.alientechuk.co.uk/pages/kess-v2"
 },
 {
  ecu_family:"MED9.1",tool_name:"AutoTuner",method:"OBD",protocol:"Virtual read (VR) and OBD write",
  verified:true,
  notes:"Manufacturer states OBD virtual read and OBD write for VAG MED9.1 MPC562/MPC564, including RSA and non-RSA variants. VR retrieves an original by ID, not a physical full ECU backup. Confirm exact vehicle, HW/SW, tool subscription and current protocol before writing.",
  source_url:"https://www.autotuner.com/blogs/news/vag-2-0-tfsi-2-5-tfsi"
 },
 {
  ecu_family:"MED9.1.2",tool_name:"AutoTuner",method:"OBD",protocol:"Virtual read (VR) and OBD write",
  verified:true,
  notes:"Manufacturer states OBD virtual read and OBD write for MED9.1.2 MPC564. Confirm exact vehicle, HW/SW and current protocol before writing.",
  source_url:"https://www.autotuner.com/blogs/news/vag-2-0-tfsi-2-5-tfsi"
 },
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
