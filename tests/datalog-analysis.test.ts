import { describe, expect, it } from "vitest";
import { isServiceCode, SERVICES } from "../lib/pricing";
import { ADDONS, ADDON_LABELS, addonPrice } from "../lib/tuning-addons";

describe("Datalog Analysis pricing and catalogue", () => {
  it("offers a standalone fixed-price £20 service", () => {
    expect(isServiceCode("datalog_analysis")).toBe(true);
    expect(SERVICES.datalog_analysis.pricePence).toBe(2000);
  });

  it("offers one shared paid diagnostic add-on", () => {
    expect(ADDONS.diagnostics.some(([id]) => id === "datalog_analysis")).toBe(true);
    expect(ADDON_LABELS["diagnostics:datalog_analysis"]).toMatch(/Datalog analysis/);
    expect(addonPrice("diagnostics:datalog_analysis")).toBe(2000);
  });

  it("does not silently price an unknown add-on", () => {
    expect(addonPrice("diagnostics:unknown")).toBeNull();
  });
});
