// Prices are controlled by the server. Never trust a price submitted by the browser.
export const SERVICES = {
  ecu_stage1: { name: "ECU Stage 1 file service", pricePence: 4500 },
  dsg_tcu: { name: "DSG / TCU calibration review", pricePence: 6000 },
  log_review: { name: "Diagnostic log / file review", pricePence: 1500 },
  emissions_diagnostics: { name: "DPF / EGR diagnostics and lawful repair assessment", pricePence: 2500 }
} as const;

export type ServiceCode = keyof typeof SERVICES;
export function isServiceCode(code: string): code is ServiceCode {
  return Object.prototype.hasOwnProperty.call(SERVICES, code);
}
