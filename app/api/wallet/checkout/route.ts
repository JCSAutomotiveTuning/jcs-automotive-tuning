import { NextResponse } from "next/server";
export const runtime = "nodejs";
// Wallet purchases are paused: service checkout is the sole payment path.
// Existing balances and historical transactions remain available for reconciliation.
export async function POST() {
  return NextResponse.json(
    { error: "Wallet top-ups are temporarily unavailable. File uploads are included in the service price; pay only through your order checkout." },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}
