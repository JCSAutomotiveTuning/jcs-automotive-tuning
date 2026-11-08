import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: vi.fn(),
  createAdmin: vi.fn(),
  order: vi.fn(),
  bank: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: state.user } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: state.createAdmin,
}));

const userId = "d808c0d3-5472-465e-8575-fc8b4ef10a24";
const orderId = "f468d9e4-d0c5-4efd-88b7-53e8a9a334a1";
const site = "https://jcs-preview.example.test";

async function checkout(origin = site) {
  const { POST } = await import("@/app/api/orders/checkout/route");
  return POST(new Request(site + "/api/orders/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ orderId }),
  }));
}

describe("Customer checkout launch safeguards (no Stripe calls)", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_mock_only");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", site);
    state.user.mockReset().mockResolvedValue({
      data: { user: { id: userId, email: "customer@example.invalid" } }, error: null,
    });
    state.order.mockReset().mockResolvedValue({
      data: {
        id: orderId, user_id: userId, service_code: "ecu_stage1",
        service_name: "ECU Stage 1 file service", amount_pence: 2020,
        deposit_pence: 2000, currency: "GBP", status: "awaiting_payment",
        payment_status: "unpaid", checkout_session_id: null,
        checkout_attempt_id: null, customer_notes: "",
      },
      error: null,
    });
    state.bank.mockReset().mockResolvedValue({ data: null, error: null });
    state.createAdmin.mockReset().mockReturnValue({
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: state.order }),
            maybeSingle: table === "orders" ? state.order : state.bank,
          }),
        }),
      }),
    });
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("rejects unauthenticated checkout before the admin DB is accessed", async () => {
    state.user.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await checkout()).status).toBe(401);
    expect(state.createAdmin).not.toHaveBeenCalled();
  });

  it("rejects live Stripe keys from a preview deployment", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_misconfigured");
    expect((await checkout()).status).toBe(503);
    expect(state.createAdmin).not.toHaveBeenCalled();
  });

  it("rejects untrusted checkout return domains", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://user:pass@malicious.example");
    expect((await checkout()).status).toBe(503);
    expect(state.createAdmin).not.toHaveBeenCalled();
  });

  it("rejects cross-origin payment requests before the admin DB is accessed", async () => {
    expect((await checkout("https://phishing.example")).status).toBe(403);
    expect(state.createAdmin).not.toHaveBeenCalled();
  });

  it("rejects remaining charges below Stripe's GBP 30p minimum", async () => {
    const response = await checkout();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("30p");
    expect(state.order).toHaveBeenCalled();
  });
});
