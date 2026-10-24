export const ADDONS = {
  petrol: [
    ["pops_bangs","Overrun sound calibration"],
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
