export const ADDONS = {
  petrol: [
    ["pops_bangs","Pops & bangs"],
    ["ac_pops_med91","MED9.1 A/C-switch pops & bangs - price to be confirmed"],
    ["multimap_med91","MED9.1 multi-map / switchable maps - price to be confirmed"],
    ["launch_control","Launch control"],
    ["cold_start","Cold-start behaviour"],
    ["rev_limit","Rev limiter review"],
    ["exhaust_flap","Exhaust flap strategy"],
    ["runner_flap","Intake runner flap calibration"],
    ["torque_limit","Torque limit review"],
  ],
  diesel: [
    ["launch_control","Launch control"],
    ["hardcut","Hardcut limiter"],
    ["pops_edc15p","EDC15P pops & bangs - price to be confirmed"],
    ["switchable_edc15p","EDC15P switchable maps - price to be confirmed"],
    ["torque_limit","Torque limit review"],
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
  "petrol:pops_bangs": 3500,
  "petrol:launch_control": 3500,
  "petrol:ac_pops_med91": null,
  "petrol:multimap_med91": null,
  "diesel:hardcut": 3500,
  "diesel:launch_control": 3500,
  "diesel:pops_edc15p": null,
  "diesel:switchable_edc15p": null,
  "tcu:launch_rpm": 4000,
};
// Any unspecified add-on also requires a custom quote.
export function addonPrice(key: string): number | null {
  return Object.prototype.hasOwnProperty.call(ADDON_PRICES, key)
    ? ADDON_PRICES[key] : null;
}
