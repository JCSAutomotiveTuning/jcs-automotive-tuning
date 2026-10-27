// Prices are controlled by the server.
// Never trust a price submitted by the browser.

export const SERVICES = {
  addons_only: {
    name: "Add-ons only — select required features",
    pricePence: 0,
  },
  ecu_stage1: {
    name: "ECU Stage 1 file service",
    pricePence: 5500,
  },
  dsg_tcu: {
    name: "DSG / TCU calibration review",
    pricePence: 7000,
  },
  log_review: {
    name: "ECU / TCU file check & review",
    pricePence: 2000,
  },
  datalog_analysis: {
    name: "Datalog analysis — technician review",
    pricePence: 2000,
  },
  emissions_diagnostics: {
    name: "DPF / EGR diagnostics and lawful repair assessment",
    pricePence: 3000,
  },
  custom_ecu: {
    name: "Custom ECU tuning — from £195",
    pricePence: 19500,
  },
  custom_tcu: {
    name: "Custom DSG / TCU tuning — from £195",
    pricePence: 19500,
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
