import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

const userId = "43aeafde-cf4a-4928-a8bc-93c84b131e54";
const orderId = "6e12d75c-75c3-46eb-9480-801c7f5147d0";
const attemptId = "19604913-8c0f-492b-81c4-395fd0f39289";
const secret = "whsec_jcs_test_only";
const stripe = new Stripe("sk_test_fake_local_only");

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_test_jcs_order_only",
    object: "checkout.session",
    mode: "payment",
    payment_status: "paid",
    amount_total: 5500,
    currency: "gbp",
    client_reference_id: userId,
    metadata: {
      type: "order_payment",
      order_id: orderId,
      user_id: userId,
      checkout_attempt_id: attemptId,
    },
    ...overrides,
  };
}

async function send(s: Record<string, unknown>, signature?: string) {
  const payload = JSON.stringify({
    id: "evt_test_jcs",
    object: "event",
    type: "checkout.session.completed",
    data: { object: s },
  });
  const header = signature ?? stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  const { POST } = await import("@/app/api/stripe/webhook/route");
  return POST(new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body: payload,
  }));
}

describe("Stripe webhook order payment security (local signatures, no network)", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake_local_only");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: "confirmed", error: null });
    mocks.createAdminClient.mockReset();
    mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects invalid signatures before database access", async () => {
    const response = await send(session(), "bad-signature");
    expect(response.status).toBe(400);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("confirms correctly matched order checkout via reserved attempt", async () => {
    const response = await send(session());
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("confirm_reserved_order_payment", {
      p_order_id: orderId,
      p_user_id: userId,
      p_attempt_id: attemptId,
      p_session_id: "cs_test_jcs_order_only",
      p_amount_pence: 5500,
    });
  });

  it("accepts already confirmed retries idempotently", async () => {
    mocks.rpc.mockResolvedValue({ data: "already_confirmed", error: null });
    const response = await send(session());
    expect(response.status).toBe(200);
  });

  it("rejects mismatched checkout ownership", async () => {
    const response = await send(session({ client_reference_id: orderId }));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid currency", async () => {
    const response = await send(session({ currency: "usd" }));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not mark unpaid checkout sessions as paid", async () => {
    const response = await send(session({ payment_status: "unpaid" }));
    expect(response.status).toBe(200);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns non-2xx when database confirmation fails so Stripe can retry", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "db failure" } });
    const response = await send(session());
    expect(response.status).toBe(500);
  });
});
