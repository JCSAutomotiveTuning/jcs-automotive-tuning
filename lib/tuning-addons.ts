export const ADDONS = {
  petrol: [
    ["pops_bangs","Pops & bangs"],
    ["ac_pops_med91","MED9.1 A/C-switch pops & bangs - price to be confirmed"],
    ["multimap_med91","MED9.1 multi-map / switchable maps - price to be confirmed"],
    ["launch_control","Launch control"],
    ["cold_start","Cold-start behaviour"],
    ["lambda_opt","Lambda / fuelling optimisation"],
    ["rev_limit","Rev limiter review"],
    ["exhaust_flap","Exhaust flap strategy"],
    ["runner_flap","Intake runner flap calibration"],
    ["torque_limit","Torque limit review"],
    ["sensor_scaling", "Sensor scaling (MAP / MAF / TMAP)"],
  ],
  diesel: [
    ["launch_control","Launch control"],
    ["hardcut","Hardcut limiter"],
    ["pops_edc15p","EDC15P pops & bangs - price to be confirmed"],
    ["switchable_edc15p","EDC15P switchable maps - price to be confirmed"],
    ["torque_limit","Torque limit review"],
    ["sensor_scaling", "Sensor scaling (MAP / MAF / TMAP)"],
    ["smoke_review","Smoke / lambda optimisation"],
    ["egr_diagnostics","EGR diagnostics / lawful repair"],
    ["dpf_diagnostics","DPF diagnostics / lawful repair"],
    ["scr_diagnostics","SCR / AdBlue diagnostics / lawful repair"],
    ["swirl_diagnostics","Swirl flap diagnostics / lawful repair"],
  ],
  tcu: [
    ["shift_speed","Shift speed optimisation"],
    ["launch_rpm","Launch RPM adjustment"],
    ["torque_capacity","Gearbox torque limit review"],
    ["shift_rpm","Shift RPM adjustment"],
    ["manual_mode","Manual mode behaviour"],
    ["kickdown","Kickdown behaviour"],
    ["gear_display","Gear display configuration"],
    ["drive_sport","Drive / Sport shift strategy"],
  ],
} as const;
export type AddonGroup = keyof typeof ADDONS;
export const ADDON_LABELS: Record<string,string> = Object.fromEntries(
  Object.entries(ADDONS).flatMap(([group, options]) =>
    options.map(([id,label]) => [`${group}:${id}`, label])
  )
);

// Prices in pence. null means a custom quote is required.
export const ADDON_PRICES: Record<string, number | null> = {
  "petrol:sensor_scaling": 3000,
  "diesel:sensor_scaling": 3000,
  "petrol:pops_bangs": 3500,
  "petrol:launch_control": 3500,
  "petrol:cold_start": 2000,
  "petrol:rev_limit": 2000,
  "petrol:lambda_opt": 3500,
  "petrol:exhaust_flap": 2500,
  "petrol:runner_flap": 2500,
  "petrol:torque_limit": 3000,
  "petrol:ac_pops_med91": null,
  "petrol:multimap_med91": null,
  "diesel:hardcut": 3500,
  "diesel:launch_control": 3500,
  "diesel:torque_limit": 3000,
  "diesel:smoke_review": 3500,
  "diesel:egr_diagnostics": 2500,
  "diesel:dpf_diagnostics": 3500,
  "diesel:scr_diagnostics": 4000,
  "diesel:swirl_diagnostics": 2500,
  "diesel:pops_edc15p": null,
  "diesel:switchable_edc15p": null,
  "tcu:shift_speed": 3000,
  "tcu:launch_rpm": 4000,
  "tcu:torque_capacity": 3000,
  "tcu:shift_rpm": 2500,
  "tcu:manual_mode": 3500,
  "tcu:kickdown": 2500,
  "tcu:gear_display": 2000,
  "tcu:drive_sport": 3500,
};

// Fixed fee per DTC review request (1-10 unique Pxxxx or Uxxxx codes).
export const DTC_REVIEW_PRICE_PENCE = 2500;
export function parseDtcCodes(input: string): string[] | null {
  const tokens = input.toUpperCase().split(/[\s,;]+/).filter(Boolean);
  if (!tokens.length || tokens.length > 10 || tokens.some(code => !/^[PU][0-9A-F]{4}$/.test(code))) return null;
  const unique = [...new Set(tokens)];
  return unique.length <= 10 ? unique : null;
}
// Any unspecified add-on also requires a custom quote.
export function addonPrice(key: string): number | null {
  return Object.prototype.hasOwnProperty.call(ADDON_PRICES, key)
    ? ADDON_PRICES[key] : null;
}
