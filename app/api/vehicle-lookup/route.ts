import {chargeSearch} from "@/lib/customer-search-quota";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to search vehicle registrations." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const registration = typeof body?.registration === "string" ? body.registration.toUpperCase().replace(/\s/g, "") : "";
  if (!/^[A-Z0-9]{2,8}$/.test(registration)) {
    return NextResponse.json({ error: "Enter a valid UK registration number." }, { status: 400 });
  }
  const key = process.env.DVLA_VES_API_KEY;
  if (!key) return NextResponse.json({ error: "Vehicle lookup is awaiting DVLA API configuration." }, { status: 503 });

  try {
    const response = await fetch("https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({ registrationNumber: registration }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 404) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    if (!response.ok) return NextResponse.json({ error: "Vehicle data provider is unavailable. Please try again." }, { status: 502 });
    const vehicle = await response.json();
    const {blocked,quota}=await chargeSearch();
    if(blocked)return blocked;
    return NextResponse.json({
      quota,
      vehicle: {
        registrationNumber: vehicle.registrationNumber,
        make: vehicle.make,
        yearOfManufacture: vehicle.yearOfManufacture,
        engineCapacity: vehicle.engineCapacity,
        fuelType: vehicle.fuelType,
        euroStatus: vehicle.euroStatus,
        colour: vehicle.colour,
      },
      tuning: {
        ecu: null, stockPowerBhp: null, stockTorqueNm: null,
        stage1PowerBhp: null, stage1TorqueNm: null,
        egr: "Unconfirmed", dpf: "Unconfirmed", adblue: "Unconfirmed",
        note: "DVLA registration data cannot verify the ECU, emissions equipment or tuning gains. Confirm using ECU identification and a matched tuning database.",
      },
    },{headers:{"Cache-Control":"private, no-store"}});
  } catch {
    return NextResponse.json({ error: "Vehicle lookup timed out. Please try again." }, { status: 504 });
  }
}
