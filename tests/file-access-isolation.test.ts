import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), orderLookup: vi.fn(), profileLookup: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.user },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: table === "orders" ? mocks.orderLookup : mocks.profileLookup,
          }),
          maybeSingle: table === "orders" ? mocks.orderLookup : mocks.profileLookup,
        }),
      }),
    }),
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
const orderId = "17ea86d9-f0a9-4666-a383-f77b996a2db8";
const userId = "249d2d26-f4b1-43f9-9837-887754a3190d";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mocks.orderLookup.mockResolvedValue({ data: null, error: null });
  mocks.profileLookup.mockResolvedValue({ data: { role: "customer" }, error: null });
});

describe("upload and privileged access isolation (mocked, no storage writes)", () => {
  it("rejects anonymous upload signing before touching service-role storage", async () => {
    mocks.user.mockResolvedValue({ data: { user: null }, error: null });
    const { POST } = await import("@/app/api/uploads/sign/route");
    const response = await POST(new Request("http://localhost/api/uploads/sign", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId, fileName: "original.bin", fileSize: 128, contentType: "application/octet-stream" }),
    }));
    expect(response.status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects uploads for orders not owned by the signed-in user", async () => {
    const { POST } = await import("@/app/api/uploads/sign/route");
    const response = await POST(new Request("http://localhost/api/uploads/sign", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId, fileName: "original.bin", fileSize: 128, contentType: "application/octet-stream" }),
    }));
    expect(response.status).toBe(404);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects completion paths outside the user's own order prefix", async () => {
    const { POST } = await import("@/app/api/uploads/complete/route");
    const response = await POST(new Request("http://localhost/api/uploads/complete", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId, path: "different-user/" + orderId + "/file-original.bin",
        fileName: "original.bin", fileSize: 128,
      }),
    }));
    expect(response.status).toBe(403);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects non-admins from the original-file library", async () => {
    const { GET } = await import("@/app/api/admin/original-library/route");
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects customer accounts from technician order listings", async () => {
    const { GET } = await import("@/app/api/staff/orders/route");
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
