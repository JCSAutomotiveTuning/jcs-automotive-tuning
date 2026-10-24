"use client";
import { useMemo, useState } from "react";

type Dtc = {code:string;title:string;category:string;checks:string};
const CODES: Dtc[] = [
  {
    "code": "16618",
    "title": "VAG 16618 — Boost Pressure Regulation: Limit Exceeded",
    "category": "VAG legacy code (commonly P0234)",
    "checks": "Check actuator control, variable vanes and requested/actual boost."
  },
  {
    "code": "17954",
    "title": "Boost Pressure Control Solenoid Short to Positive",
    "category": "VAG legacy",
    "checks": "Commonly P1546; check N75 wiring and power."
  },
  {
    "code": "17955",
    "title": "Boost Pressure Control Solenoid Short to Ground",
    "category": "VAG legacy",
    "checks": "Commonly P1547; check N75 wiring and short."
  },
  {
    "code": "17956",
    "title": "Boost Pressure Control Solenoid Open Circuit",
    "category": "VAG legacy",
    "checks": "Commonly P1548; inspect N75 circuit."
  },
  {
    "code": "17963",
    "title": "Charge Pressure Upper Limit Exceeded",
    "category": "VAG legacy",
    "checks": "Commonly P1555; check boost regulation and actuator travel."
  },
  {
    "code": "17964",
    "title": "VAG 17964 — Charge Pressure Control: Negative Deviation",
    "category": "VAG legacy code (commonly P1556)",
    "checks": "Check boost leak, vacuum supply, N75 and turbo actuator."
  },
  {
    "code": "17965",
    "title": "VAG 17965 — Charge Pressure Control: Positive Deviation",
    "category": "VAG legacy code (commonly P1557)",
    "checks": "Check VNT sticking, vacuum control and charge pressure sensor."
  },
  {
    "code": "17978",
    "title": "Engine Start Blocked by Immobilizer",
    "category": "VAG legacy",
    "checks": "Equivalent to P1570 on relevant VAG applications; inspect immobilizer faults."
  },
  {
    "code": "18000",
    "title": "Altitude/Boost Pressure Sensor Implausible Correlation",
    "category": "VAG legacy",
    "checks": "Commonly P1592; verify exact ECU definition, MAP/BARO readings and wiring."
  },
  {
    "code": "P000A",
    "title": "A Camshaft Position Slow Response (Bank 1)",
    "category": "Generic OBD-II",
    "checks": "Check cam adjuster, oil supply, control valve and phase response logs."
  },
  {
    "code": "P0011",
    "title": "Camshaft Position Timing Over-Advanced (Bank 1)",
    "category": "Generic OBD-II",
    "checks": "Check oil pressure/quality, timing, cam actuator and commanded versus actual angle."
  },
  {
    "code": "P0087",
    "title": "Fuel Rail/System Pressure Too Low",
    "category": "Generic OBD-II",
    "checks": "Check low-pressure supply, fuel filter, rail target versus actual and leakage."
  },
  {
    "code": "P0100",
    "title": "Mass Air Flow Circuit Malfunction",
    "category": "Air metering",
    "checks": "Inspect MAF wiring, supply, ground and intake tract."
  },
  {
    "code": "P0101",
    "title": "Mass or Volume Air Flow Circuit Range/Performance",
    "category": "Generic OBD-II",
    "checks": "Inspect MAF signal, intake leaks, air filter and expected airflow."
  },
  {
    "code": "P0102",
    "title": "Mass Air Flow Circuit Low",
    "category": "Air metering",
    "checks": "Check MAF power supply, signal and intake restrictions."
  },
  {
    "code": "P0103",
    "title": "Mass Air Flow Circuit High",
    "category": "Air metering",
    "checks": "Check MAF signal plausibility, shorts and wiring."
  },
  {
    "code": "P0113",
    "title": "Intake Air Temperature Sensor High Input",
    "category": "Sensors",
    "checks": "Check IAT connector and open circuit; compare cold-soak reading."
  },
  {
    "code": "P0116",
    "title": "Engine Coolant Temperature Range/Performance",
    "category": "Cooling",
    "checks": "Compare cold coolant temperature to ambient; check thermostat and sensor."
  },
  {
    "code": "P0117",
    "title": "Engine Coolant Temperature Low Input",
    "category": "Cooling",
    "checks": "Check sensor short to ground and wiring."
  },
  {
    "code": "P0118",
    "title": "Engine Coolant Temperature High Input",
    "category": "Cooling",
    "checks": "Check sensor open circuit and wiring."
  },
  {
    "code": "P0128",
    "title": "Coolant Thermostat Below Regulating Temperature",
    "category": "Cooling",
    "checks": "Verify warm-up profile, thermostat operation and coolant sensor."
  },
  {
    "code": "P0130",
    "title": "Oxygen Sensor Circuit Bank 1 Sensor 1",
    "category": "Emissions",
    "checks": "Inspect upstream oxygen sensor signal, heater and exhaust leaks."
  },
  {
    "code": "P0135",
    "title": "Oxygen Sensor Heater Bank 1 Sensor 1",
    "category": "Emissions",
    "checks": "Check heater resistance, fuse, power and ECU control."
  },
  {
    "code": "P0171",
    "title": "System Too Lean Bank 1",
    "category": "Fuel trim",
    "checks": "Check unmetered air, PCV, MAF and fuel pressure."
  },
  {
    "code": "P0172",
    "title": "System Too Rich Bank 1",
    "category": "Fuel trim",
    "checks": "Check injector leakage, MAF, fuel pressure and trims."
  },
  {
    "code": "P0191",
    "title": "Fuel Rail Pressure Sensor Range/Performance",
    "category": "Fuel pressure",
    "checks": "Log requested versus actual rail pressure and inspect sensor wiring."
  },
  {
    "code": "P0192",
    "title": "Fuel Rail Pressure Sensor Low Input",
    "category": "Fuel pressure",
    "checks": "Inspect rail sensor voltage and wiring."
  },
  {
    "code": "P0193",
    "title": "Fuel Rail Pressure Sensor High Input",
    "category": "Fuel pressure",
    "checks": "Inspect rail sensor signal and open circuits."
  },
  {
    "code": "P0201",
    "title": "Injector Circuit Cylinder 1",
    "category": "Injection",
    "checks": "Check injector harness, resistance and ECU driver diagnostics."
  },
  {
    "code": "P0202",
    "title": "Injector Circuit Cylinder 2",
    "category": "Injection",
    "checks": "Check injector harness, resistance and ECU driver diagnostics."
  },
  {
    "code": "P0203",
    "title": "Injector Circuit Cylinder 3",
    "category": "Injection",
    "checks": "Check injector harness, resistance and ECU driver diagnostics."
  },
  {
    "code": "P0204",
    "title": "Injector Circuit Cylinder 4",
    "category": "Injection",
    "checks": "Check injector harness, resistance and ECU driver diagnostics."
  },
  {
    "code": "P0234",
    "title": "Turbocharger/Supercharger Overboost",
    "category": "Generic OBD-II",
    "checks": "Check VNT/wastegate movement, boost solenoid, vacuum lines and MAP plausibility."
  },
  {
    "code": "P0299",
    "title": "Turbocharger Underboost",
    "category": "Boost",
    "checks": "Pressure-test charge tract; log requested/actual boost and actuator position."
  },
  {
    "code": "P0300",
    "title": "Random/Multiple Cylinder Misfire Detected",
    "category": "Generic OBD-II",
    "checks": "Log cylinder misfire counters; inspect ignition, injectors, compression and air leaks."
  },
  {
    "code": "P0301",
    "title": "Cylinder 1 Misfire Detected",
    "category": "Generic OBD-II",
    "checks": "Inspect cylinder 1 ignition/injection, compression and wiring."
  },
  {
    "code": "P0302",
    "title": "Cylinder 2 Misfire Detected",
    "category": "Misfire",
    "checks": "Compare cylinder misfire counters, coils, plugs and compression."
  },
  {
    "code": "P0303",
    "title": "Cylinder 3 Misfire Detected",
    "category": "Misfire",
    "checks": "Compare cylinder misfire counters, coils, plugs and compression."
  },
  {
    "code": "P0304",
    "title": "Cylinder 4 Misfire Detected",
    "category": "Misfire",
    "checks": "Compare cylinder misfire counters, coils, plugs and compression."
  },
  {
    "code": "P0327",
    "title": "Knock Sensor 1 Low Input",
    "category": "Ignition",
    "checks": "Check sensor torque, harness and knock adaptation."
  },
  {
    "code": "P0335",
    "title": "Crankshaft Position Sensor Circuit",
    "category": "Timing",
    "checks": "Check crank signal, connector and cranking RPM."
  },
  {
    "code": "P0340",
    "title": "Camshaft Position Sensor Circuit",
    "category": "Timing",
    "checks": "Check cam signal, wiring and cam/crank synchronisation."
  },
  {
    "code": "P0341",
    "title": "Camshaft Position Sensor Range/Performance",
    "category": "Timing",
    "checks": "Inspect cam/crank correlation, timing and sensor signal."
  },
  {
    "code": "P0401",
    "title": "Exhaust Gas Recirculation Flow Insufficient",
    "category": "Generic OBD-II",
    "checks": "Inspect EGR operation, deposits, MAF readings and intake restrictions."
  },
  {
    "code": "P0402",
    "title": "EGR Flow Excessive",
    "category": "EGR",
    "checks": "Check EGR valve sealing and commanded versus measured airflow."
  },
  {
    "code": "P0403",
    "title": "EGR Control Circuit",
    "category": "Generic OBD-II",
    "checks": "Check EGR electrical connector, supply, ground and actuator circuit."
  },
  {
    "code": "P0404",
    "title": "EGR Control Circuit Range/Performance",
    "category": "EGR",
    "checks": "Inspect EGR travel, feedback and adaptation."
  },
  {
    "code": "P0441",
    "title": "EVAP Incorrect Purge Flow",
    "category": "EVAP",
    "checks": "Check purge valve sealing, hoses and commanded purge."
  },
  {
    "code": "P0443",
    "title": "EVAP Purge Valve Circuit",
    "category": "EVAP",
    "checks": "Inspect purge valve electrical supply, control and connector."
  },
  {
    "code": "P0507",
    "title": "Idle Control RPM Higher Than Expected",
    "category": "Idle",
    "checks": "Inspect intake leaks, throttle adaptation and PCV."
  },
  {
    "code": "P0562",
    "title": "System Voltage Low",
    "category": "Electrical",
    "checks": "Load-test battery and charging circuit; inspect grounds."
  },
  {
    "code": "P0606",
    "title": "ECM/PCM Processor Fault",
    "category": "ECU",
    "checks": "Verify supply voltage, grounds, software integrity and fault history."
  },
  {
    "code": "P0638",
    "title": "Throttle Actuator Range/Performance",
    "category": "Throttle",
    "checks": "Check throttle plate movement, wiring and basic settings."
  },
  {
    "code": "P0671",
    "title": "Cylinder 1 Glow Plug Circuit",
    "category": "Glow system",
    "checks": "Check glow plug and wiring; test controller output."
  },
  {
    "code": "P0672",
    "title": "Cylinder 2 Glow Plug Circuit",
    "category": "Glow system",
    "checks": "Check glow plug and wiring; test controller output."
  },
  {
    "code": "P0673",
    "title": "Cylinder 3 Glow Plug Circuit",
    "category": "Glow system",
    "checks": "Check glow plug and wiring; test controller output."
  },
  {
    "code": "P0674",
    "title": "Cylinder 4 Glow Plug Circuit",
    "category": "Glow system",
    "checks": "Check glow plug and wiring; test controller output."
  },
  {
    "code": "P0700",
    "title": "Transmission Control System MIL Request",
    "category": "Transmission",
    "checks": "Read transmission controller faults; this is a request code."
  },
  {
    "code": "P0722",
    "title": "Output Speed Sensor No Signal",
    "category": "Transmission",
    "checks": "Log output shaft speed and inspect sensor wiring."
  },
  {
    "code": "P1556",
    "title": "Charge Pressure Control Negative Deviation",
    "category": "VAG legacy",
    "checks": "Inspect charge leaks, vacuum supply, N75 and actuator."
  },
  {
    "code": "P1557",
    "title": "Charge Pressure Control Positive Deviation",
    "category": "VAG legacy",
    "checks": "Inspect sticky VNT, N75 control and boost sensor."
  },
  {
    "code": "P1570",
    "title": "Engine Start Blocked by Immobilizer",
    "category": "VAG legacy",
    "checks": "Read immobilizer and engine faults; verify keys and authorisation."
  },
  {
    "code": "P1592",
    "title": "Altitude/Boost Pressure Sensor Implausible Correlation",
    "category": "VAG legacy",
    "checks": "Compare barometric and manifold pressure at key-on engine-off."
  },
  {
    "code": "P2002",
    "title": "DPF Efficiency Below Threshold",
    "category": "DPF",
    "checks": "Inspect exhaust leaks, pressure sensor plausibility and soot loading."
  },
  {
    "code": "P2004",
    "title": "Intake Manifold Runner Control Stuck Open",
    "category": "Generic OBD-II",
    "checks": "Inspect runner mechanism, actuator, vacuum and position feedback."
  },
  {
    "code": "P2008",
    "title": "Intake Manifold Runner Control Circuit Open",
    "category": "Intake",
    "checks": "Check runner actuator circuit, supply and connector."
  },
  {
    "code": "P2015",
    "title": "Intake Manifold Runner Position Sensor/Switch Range/Performance",
    "category": "Generic OBD-II",
    "checks": "Inspect runner linkage, end stops, sensor wiring and adaptation."
  },
  {
    "code": "P2016",
    "title": "Intake Manifold Runner Position Sensor Low",
    "category": "Intake",
    "checks": "Inspect position sensor voltage, linkage and wiring."
  },
  {
    "code": "P2017",
    "title": "Intake Manifold Runner Position Sensor High",
    "category": "Intake",
    "checks": "Inspect position sensor voltage, linkage and wiring."
  },
  {
    "code": "P2187",
    "title": "System Too Lean at Idle Bank 1",
    "category": "Fuel trim",
    "checks": "Smoke-test intake and PCV; check idle fuel trims."
  },
  {
    "code": "P2293",
    "title": "Fuel Pressure Regulator 2 Performance",
    "category": "Fuel pressure",
    "checks": "Log rail pressure under load; check HPFP control and supply."
  },
  {
    "code": "P2452",
    "title": "DPF Differential Pressure Sensor Circuit",
    "category": "DPF",
    "checks": "Check differential pressure sensor supply, hoses and wiring."
  },
  {
    "code": "P2453",
    "title": "Diesel Particulate Filter Pressure Sensor Range/Performance",
    "category": "Generic OBD-II",
    "checks": "Check differential pressure sensor, hoses, wiring and plausibility at key-on."
  },
  {
    "code": "P2463",
    "title": "DPF Soot Accumulation",
    "category": "DPF",
    "checks": "Check measured/calculated soot and underlying regeneration faults."
  },
  {
    "code": "P2563",
    "title": "Turbocharger Boost Control Position Sensor Range/Performance",
    "category": "Generic OBD-II",
    "checks": "Inspect actuator position feedback, linkage travel, wiring and adaptation."
  },
  {
    "code": "P2564",
    "title": "Turbo Boost Control Position Sensor Low",
    "category": "Boost",
    "checks": "Check actuator position signal and wiring."
  },
  {
    "code": "P2565",
    "title": "Turbo Boost Control Position Sensor High",
    "category": "Boost",
    "checks": "Check actuator position signal and wiring."
  },
  {
    "code": "P2711",
    "title": "Unexpected/Implausible Mechanical Gear Disengagement",
    "category": "DSG",
    "checks": "Check gearbox fault context, clutch slip, input speeds and adaptations."
  },
  {
    "code": "U0100",
    "title": "Lost Communication With ECM/PCM",
    "category": "CAN network",
    "checks": "Check power, ground, CAN integrity and gateway faults."
  },
  {
    "code": "U0101",
    "title": "Lost Communication With TCM",
    "category": "CAN network",
    "checks": "Check TCM supply, CAN wiring and gateway installation list."
  },
  {
    "code": "U0121",
    "title": "Lost Communication With ABS Control Module",
    "category": "CAN network",
    "checks": "Check ABS supply, CAN network and gateway faults."
  },
  {
    "code": "U0155",
    "title": "Lost Communication With Instrument Cluster",
    "category": "CAN network",
    "checks": "Check cluster supply, CAN bus and gateway communication."
  }
];
const normalize=(s:string)=>s.toUpperCase().replace(/[^A-Z0-9]/g,"");
const categories=["All",...Array.from(new Set(CODES.map(x=>x.category))).sort()];
const aliases:Record<string,string>={"17964":"P1556","17965":"P1557","17978":"P1570","17963":"P1555","18000":"P1592","17954":"P1546","17955":"P1547","17956":"P1548"};
export default function DtcLookup(){
 const [query,setQuery]=useState("");
 const [category,setCategory]=useState("All");
 const [expanded,setExpanded]=useState<string|null>(null);
 const matches=useMemo(()=>{
   const q=normalize(query);
   return CODES.filter(x=>(category==="All"||x.category===category)&&(!q||normalize([x.code,x.title,x.category,x.checks].join(" ")).includes(q)||aliases[q]===x.code)).sort((a,b)=>a.code.localeCompare(b.code));
 },[query,category]);
 return <div className="space-y-5">
 <div className="rounded-2xl border border-white/10 bg-[#101620] p-5 space-y-3">
  <h2 className="text-xl font-bold text-white">JCS Diagnostic Trouble Code Library</h2>
  <p className="text-sm text-slate-300">Search code, symptom, component or diagnostic check. {CODES.length} curated entries covering engine, emissions, VAG legacy, DSG and CAN network faults.</p>
  <label htmlFor="dtc-search" className="block text-sm font-semibold text-white">DTC search</label>
  <input id="dtc-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="P0299, 17964, N75, fuel rail, misfire..." className="w-full rounded-xl border border-white/20 bg-[#090d14] p-3 text-white outline-none focus:border-sky-400"/>
  <div className="flex flex-wrap gap-2">
  <select aria-label="Filter by system" value={category} onChange={e=>setCategory(e.target.value)} className="rounded-lg bg-[#090d14] border border-white/20 text-white p-2">{categories.map(c=><option key={c} value={c}>{c}</option>)}</select>
  <button type="button" onClick={()=>{setQuery("");setCategory("All");setExpanded(null)}} className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white">Clear filters</button>
  </div>
  <p className="text-xs text-slate-400">Reference only. Codes, failure-type bytes and diagnostics can differ by manufacturer, ECU software, model and year. Confirm against OEM information and live data before replacing parts.</p>
 </div>
 <p className="text-sm text-slate-300">{matches.length} matching codes</p>
 <div className="grid gap-3">{matches.slice(0,150).map(x=><article key={x.code} className="rounded-xl border border-white/10 bg-[#101620] p-5">
 <p className="text-xs font-bold text-sky-300">{x.code} · {x.category}</p>
 <h3 className="mt-2 text-lg font-bold text-white">{x.title}</h3>
 <p className="mt-2 text-sm text-slate-300"><strong>Diagnostic starting points:</strong> {x.checks}</p>
 <button type="button" onClick={()=>setExpanded(expanded===x.code?null:x.code)} className="mt-3 text-sm text-sky-300 underline">{expanded===x.code?"Hide diagnostic workflow":"Show diagnostic workflow"}</button>
 {expanded===x.code&&<div className="mt-3 rounded-lg bg-[#090d14] p-4 text-sm text-slate-300 space-y-2">
 <p><strong>1. Confirm:</strong> Save the full scan, freeze-frame data, ECU part number, software version and fault status before clearing codes.</p>
 <p><strong>2. Reproduce:</strong> Check when the fault occurs (cold start, idle, load, gear change or regeneration). Record relevant measuring values.</p>
 <p><strong>3. Test:</strong> {x.checks} Verify wiring, supply and ground where applicable; avoid parts replacement based on the code alone.</p>
 <p><strong>4. Validate:</strong> Repair the underlying cause, clear the fault when appropriate and repeat the original operating conditions.</p>
 </div>}
 </article>)}{matches.length>150&&<p className="text-slate-400">Showing first 150 matches. Refine your search.</p>}
 {!matches.length&&<p className="text-slate-400">No matching code in this curated library. Verify the exact definition in OEM diagnostic data.</p>}</div>
 </div>;
}
