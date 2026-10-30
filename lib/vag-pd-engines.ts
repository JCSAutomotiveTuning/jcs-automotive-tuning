/** Engine-code lookup is identification guidance, never proof of the ECU installed. */
export const PD_ENGINES=[
 {code:"AXR",label:"PD100",ecu:"EDC15P+",power:100},
 {code:"ATD",label:"PD100",ecu:"EDC15P+",power:100},
 {code:"AJM",label:"PD115",ecu:"EDC15P+",power:115},
 {code:"AUY",label:"PD115",ecu:"EDC15P+",power:115},
 {code:"ASZ",label:"PD130",ecu:"EDC15P+",power:130},
 {code:"BLT",label:"PD130",ecu:"EDC15P+",power:130},
 {code:"ARL",label:"PD150",ecu:"EDC15P+",power:150},
 {code:"BPX",label:"PD160 Ibiza Cupra",ecu:"EDC15P+",power:160},
 {code:"BUK",label:"PD160 Ibiza Cupra",ecu:"EDC15P+",power:160},
] as const;
export function pdEngineWarning(q:string){const v=q.trim().toUpperCase().replace(/[^A-Z0-9]/g,"");return v==="PD110"?"Most VAG 1.9 TDI 110 PS engines use a rotary injection pump, not PD. Confirm engine code (e.g. AHF/ASV) and ECU before selecting EDC15P+.":null;}
export function lookupPdEngine(q:string){
 const normalized=q.trim().toUpperCase().replace(/[^A-Z0-9+]/g,"");
 const hits=PD_ENGINES.filter(e=>e.code===normalized);
 if(hits.length)return hits;
 if(normalized.startsWith("EDC15P"))return PD_ENGINES;
 const power=normalized.match(/^PD(100|115|130|150|160)$/);
 return power?PD_ENGINES.filter(e=>e.power===Number(power[1])):[];
}
