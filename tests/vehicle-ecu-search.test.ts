import {describe,it,expect} from "vitest";
import {cleanVehicleSearch,pdAliases,vehicleSearchTokens} from "@/lib/vehicle-ecu-search";

describe("Vehicle ECU finder query safety and aliases",()=>{
 it("keeps MED9 identifiers and strips unsafe PostgREST operator symbols",()=>{
  expect(cleanVehicleSearch("  MED9.1   ")).toBe("MED9.1");
  expect(cleanVehicleSearch("AXR,make.eq.secret")).toBe("AXRmake.eq.secret");
  expect(cleanVehicleSearch("EDC15P+")).toBe("EDC15P+");
 });
 it("splits multiword make/model searches and VW aliases",()=>{
  expect(vehicleSearchTokens("VW Golf")).toEqual(["Volkswagen","Golf"]);
  expect(vehicleSearchTokens("EDC15P+")).toEqual(["EDC15P"]);
  expect(vehicleSearchTokens("Skoda Octavia CAYC")).toEqual(["Skoda","Octavia","CAYC"]);
 });
 it("preserves PD injection engine groups without assigning rotary-pump PD110 to PD130",()=>{
  expect(pdAliases.PD130).toContain("ASZ");
  expect(pdAliases.PD160).toContain("BPX");
  expect(pdAliases.PD110).not.toContain("ASZ");
  expect(pdAliases.PD110).toContain("ASV");
 });
});
