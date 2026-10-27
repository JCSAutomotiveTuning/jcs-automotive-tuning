import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const steps = {
  makes: { path: "/v1/carinfo/makes", param: null },
  models: { path: "/v1/carinfo/models", param: "make" },
  generations: { path: "/v1/carinfo/generations", param: "model" },
  engines: { path: "/v1/carinfo/engines", param: "generation" },
  vehicle: { path: "/v1/carinfo/vehicle", param: "engine" },
} as const;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Sign in to use ECU lookup." }, { status: 401 });

  const key = process.env.ECUFINDER_CARINFO_API_KEY;
  if (!key) return NextResponse.json({ error: "ECU catalogue is awaiting API activation." }, { status: 503 });
  const step = req.nextUrl.searchParams.get("step");
  if (!step || !(step in steps)) return NextResponse.json({ error: "Invalid lookup step." }, { status: 400 });
  const config = steps[step as keyof typeof steps];
  const url = new URL("https://api.ecufinder.pro" + config.path);
  if (config.param) {
    const id = req.nextUrl.searchParams.get(config.param);
    if (!id || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) return NextResponse.json({ error: "Invalid vehicle selection." }, { status: 400 });
    url.searchParams.set(config.param, id);
  }
  try {
    const response = await fetch(url.toString(), {
      headers: { "X-API-Key": key, "Accept": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: response.status === 401 || response.status === 403 ? "ECU catalogue access is not authorised." : "ECU catalogue temporarily unavailable." }, { status: 502 });
    }
    const data: unknown = await response.json();
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "ECU catalogue lookup timed out." }, { status: 504 });
  }
}
