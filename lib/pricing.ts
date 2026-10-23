// Prices are controlled by the server.
// Never trust a price submitted by the browser.

export const SERVICES = {
  ecu_stage1: {
    name: "ECU Stage 1 file service",
    pricePence: 4500,
  },
  dsg_tcu: {
    name: "DSG / TCU calibration review",
    pricePence: 6000,
  },
  log_review: {
    name: "Diagnostic log / file review",
    pricePence: 1500,
  },
  emissions_diagnostics: {
    name: "DPF / EGR diagnostics and lawful repair assessment",
    pricePence: 2500,
  },
  custom_ecu: {
    name: "Custom ECU tuning — from £180",
    pricePence: 18000,
  },
  custom_tcu: {
    name: "Custom DSG / TCU tuning — from £180",
    pricePence: 18000,
  },
  ecu_tcu_package: {
    name: "Custom ECU + DSG / TCU package — quote required",
    pricePence: 0,
  },
} as const;

export type ServiceCode = keyof typeof SERVICES;

export function isServiceCode(code: string): code is ServiceCode {
  return Object.prototype.hasOwnProperty.call(SERVICES, code);
}
