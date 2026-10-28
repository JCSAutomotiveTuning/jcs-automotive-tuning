import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SERVICES } from "../lib/pricing";

// Keep the public pricing display aligned with server-controlled checkout prices.
// This tests copy drift; server order creation remains the payment authority.
describe("homepage service price parity", () => {
  const home = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");
  const advertised: Record<string, string> = {
    ecu_stage1: "Stage 1 ECU File Service",
    dsg_tcu: "DSG / TCU Calibration Review",
    log_review: "ECU / TCU File Check & Review",
    datalog_analysis: "Datalog Analysis — Technician Review",
    emissions_diagnostics: "DPF / EGR Diagnostics",
    custom_ecu: "Custom ECU Tuning",
    custom_tcu: "Custom DSG / TCU Tuning",
  };

  for (const [code, title] of Object.entries(advertised)) {
    it(`shows the server price for ${code}`, () => {
      const start = home.indexOf(`name: "${title}"`);
      expect(start).toBeGreaterThanOrEqual(0);
      const service = SERVICES[code as keyof typeof SERVICES];
      const price = new Intl.NumberFormat("en-GB", {
        style: "currency", currency: "GBP", maximumFractionDigits: 0,
      }).format(service.pricePence / 100);
      const card = home.slice(start, home.indexOf("},", start));
      expect(card).toContain(`price: "${code.startsWith("custom_") ? "From " : ""}${price}"`);
    });
  }
});
