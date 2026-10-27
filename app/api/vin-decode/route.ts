import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VpicResult = Record<string, string | null>;
const clean = (value: unknown) => typeof value === "string" && value.trim() && value.trim().toLowerCase() !== "not applicable" ? value.trim() : null;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Sign in to decode a VIN." }, { status: 401 });

  const vin = (req.nextUrl.searchParams.get("vin") ?? "").trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return NextResponse.json({ error: "Enter a valid 17-character VIN (no I, O or Q)." }, { status: 400 });
  }

  try {
    const url = new URL("https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/" + encodeURIComponent(vin));
    url.searchParams.set("format", "json");
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!response.ok) return NextResponse.json({ error: "VIN data provider is temporarily unavailable." }, { status: 502 });
    const payload = await response.json() as { Results?: VpicResult[] };
    const result = payload.Results?.[0];
    if (!result) return NextResponse.json({ error: "No VIN information returned." }, { status: 404 });
    const errorCode = clean(result.ErrorCode);
    const errors = errorCode ? errorCode.split(",").map(s=>s.trim()).filter(s=>s!=="0") : [];
    const vehicle = {
      vin, make:clean(result.Make), model:clean(result.Model), modelYear:clean(result.ModelYear),
      trim:clean(result.Trim), bodyClass:clean(result.BodyClass), vehicleType:clean(result.VehicleType),
      engineModel:clean(result.EngineModel), engineCylinders:clean(result.EngineCylinders),
      displacementL:clean(result.DisplacementL), fuelType:clean(result.FuelTypePrimary),
      enginePowerKW:clean(result.EngineKW), manufacturer:clean(result.Manufacturer),
    };
    return NextResponse.json({
      vehicle,
      warning: errors.length ? clean(result.ErrorText) || "VIN decoding was incomplete." : null,
      ecu: null,
      note: "NHTSA vPIC provides manufacturer-submitted vehicle details, not a verified ECU part number, tuning gains or emissions hardware. UK-market VINs may return incomplete data.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "VIN lookup timed out. Please try again." }, { status: 504 });
  }
}
