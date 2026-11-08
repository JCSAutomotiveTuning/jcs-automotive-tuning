import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: vi.fn(),
  quota: vi.fn(),
  insert: vi.fn(),
  createAdmin: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: state.user } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: state.createAdmin,
}));

const userId = "b08156a8-e27a-4eac-bd4b-5f8b8d981e89";
const orderId = "b33e3b6d-3405-4c5a-9a2e-8f49a4aa1e6c";

async function submit() {
  const { POST } = await import("@/app/api/orders/route");
  return POST(new Request("https://example.invalid/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceCode: "ecu_stage1",
      vehicleMake: "Audi",
      vehicleModel: "A3",
      fuelType: "petrol",
      notes: "Test fixture - never submitted to Supabase",
    }),
  }));
}

describe("Legacy order submission anti-spam safeguard (mocked)", () => {
  beforeEach(() => {
    vi.stubEnv("JCS_WALLET_DEPOSITS_ENABLED", "false");
    state.user.mockReset().mockResolvedValue({ data: { user: { id: userId } }, error: null });
    state.quota.mockReset().mockResolvedValue({ count: 0, error: null });
    state.insert.mockReset().mockImplementation((row) => ({
      select: () => ({
        single: async () => ({
          data: { id: orderId, service_code: row.service_code, amount_pence: row.amount_pence },
          error: null,
        }),
      }),
    }));
    state.createAdmin.mockReset().mockReturnValue({
      from: (table: string) => {
        if (table !== "orders") throw new Error("Unexpected table: " + table);
        return {
          select: (_columns: string, options: unknown) => {
            if (!options) throw new Error("Expected exact-count quota query");
            return { eq: () => ({ not: state.quota }) };
          },
          insert: state.insert,
        };
      },
    });
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("blocks anonymous submissions", async () => {
    state.user.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await submit()).status).toBe(401);
    expect(state.createAdmin).not.toHaveBeenCalled();
  });

  it("limits customers to three open orders when deposits are paused", async () => {
    state.quota.mockResolvedValueOnce({ count: 3, error: null });
    const response = await submit();
    expect(response.status).toBe(429);
    expect(state.insert).not.toHaveBeenCalled();
    expect(state.quota).toHaveBeenCalledWith("status", "in", "(completed,cancelled,failed)");
  });

  it("fails closed when the quota database is unavailable", async () => {
    state.quota.mockResolvedValueOnce({ count: null, error: { message: "database unavailable" } });
    expect((await submit()).status).toBe(503);
    expect(state.insert).not.toHaveBeenCalled();
  });

  it("allows submissions below the limit with server-calculated pricing", async () => {
    state.quota.mockResolvedValueOnce({ count: 2, error: null });
    const response = await submit();
    expect(response.status).toBe(200);
    expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: userId, service_code: "ecu_stage1", amount_pence: 5500,
      status: "awaiting_review", payment_status: "unpaid",
    }));
    expect((await response.json()).order.id).toBe(orderId);
  });
});
