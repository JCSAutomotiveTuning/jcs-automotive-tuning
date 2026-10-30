// Strictly prevent PostgREST filter operators or wildcards from entering .or() expressions.
export function cleanVehicleSearch(value:string){
 return value.trim().slice(0,70).replace(/[^a-zA-Z0-9\s.+/\-]/g,"").replace(/\s+/g," ").trim();
}
export const pdAliases:Readonly<Record<string,string[]>>={
 PD100:["AXR","ATD","AVB","BEW"],PD115:["AJM","AUY"],
 PD130:["ASZ","BLT","AVF","AWX"],PD150:["ARL"],PD160:["BPX","BUK"],
 PD110:["AHF","ASV"],
};
export function vehicleSearchTokens(q:string):string[]{
 return q.toUpperCase()==="VW"?["Volkswagen"]:
 q.split(" ").filter(Boolean).map(t=>t.toUpperCase()==="VW"?"Volkswagen":t.toUpperCase().startsWith("EDC15P")?"EDC15P":t);
}
