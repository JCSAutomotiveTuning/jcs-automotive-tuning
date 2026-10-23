
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isServiceCode, SERVICES } from "@/lib/pricing";

const schema = z.object({
  serviceCode: z.string(),
  vehicleMake: z.string().trim().min(1).max(60),
  vehicleModel: z.string().trim().min(1).max(80),
  engineCode: z.string().trim().max(80).optional().default(""),
  softwareId: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(3000).optional().default(""),
});

export async function POST(req: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Please sign in first." },
      { status: 401 }
    );
  }

  const parsed = schema.safeParse(
    await req.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the submitted fields." },
      { status: 400 }
    );
  }

  const v = parsed.data;

  if (!isServiceCode(v.serviceCode)) {
    return NextResponse.json(
      { error: "Unsupported service." },
      { status: 400 }
    );
  }

  const quoteRequired = v.serviceCode === "ecu_tcu_package";
  const service = SERVICES[v.serviceCode];

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      service_code: v.serviceCode,
      service_name: service.name,
      amount_pence: service.pricePence,
      currency: "GBP",
      // Keep the existing database-compatible review status.
      // Quote requests are distinguished by quoteRequired and service_code.
      status: "awaiting_review",
      payment_status: "unpaid",
      vehicle_make: v.vehicleMake,
      vehicle_model: v.vehicleModel,
      engine_code: v.engineCode || null,
      software_id: v.softwareId || null,
      customer_notes: v.notes || null,
    })
    .select(
      "id,service_code,status,payment_status,amount_pence"
    )
    .single();

  if (error) {
    console.error("Order creation failed:", error);

    return NextResponse.json(
      { error: "Could not create order. Check database setup." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    order,
    quoteRequired,
    message: quoteRequired
      ? "Quote requested. JCS Automotive Tuning must confirm the price before work proceeds."
      : "Order submitted for review. Confirm the agreed price before custom tuning begins.",
  });
}
