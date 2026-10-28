import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const CreateTicketSchema = z.object({
  subject: z.string().trim().min(5).max(200),
  category: z.enum([
    "general",
    "ecu_tuning",
    "dsg_tcu",
    "diagnostics",
    "file_upload",
    "payment",
    "other",
  ]),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  orderId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1).max(10000),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("support_tickets")
    .select(
      "id,subject,category,priority,status,order_id,created_at,updated_at,last_message_at"
    )
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Support ticket lookup failed:", error.message);
    return NextResponse.json(
      { error: "Could not load support tickets." },
      { status: 500 }
    );
  }

  return NextResponse.json({ tickets: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = CreateTicketSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the subject, category, priority and message." },
      { status: 400 }
    );
  }

  const input = parsed.data;

  if (input.orderId) {
    const { data: linkedOrder, error: linkedOrderError } = await supabase
      .from("orders")
      .select("id")
      .eq("id", input.orderId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (linkedOrderError) {
      console.error("Support order ownership check failed:", linkedOrderError.message);
      return NextResponse.json({ error: "Could not verify linked order." }, { status: 503 });
    }

    if (!linkedOrder) {
      return NextResponse.json({ error: "Linked order not found." }, { status: 404 });
    }
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      order_id: input.orderId || null,
      subject: input.subject,
      category: input.category,
      priority: input.priority,
      status: "open",
    })
    .select(
      "id,subject,category,priority,status,order_id,created_at,updated_at,last_message_at"
    )
    .single();

  if (ticketError || !ticket) {
    console.error("Support ticket creation failed:", ticketError?.message);
    return NextResponse.json(
      {
        error:
          "Could not create the ticket. Check that the support database tables and policies have been installed.",
      },
      { status: 400 }
    );
  }

  const { error: messageError } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      body: input.message,
      internal_note: false,
    });

  if (messageError) {
    console.error("Initial support message failed:", messageError.message);

    // Roll back the ticket if its initial message could not be saved.
    // The service-role client is used only on this server-side route.
    try {
      const admin = createAdminClient();
      await admin
        .from("support_tickets")
        .delete()
        .eq("id", ticket.id)
        .eq("user_id", user.id);
    } catch (rollbackError) {
      console.error("Support ticket rollback failed:", rollbackError);
    }

    return NextResponse.json(
      { error: "The initial message could not be saved. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ticket }, { status: 201 });
}
