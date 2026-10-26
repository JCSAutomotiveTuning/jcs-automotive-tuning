import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

describe("Outdated customer information notification", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    mocks.createAdminClient.mockReset();
  });

  it("processes information request when customer information is needed", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test");

    const fetchMock = vi.fn(() => {
      throw new Error("External network calls are forbidden");
    });

    vi.stubGlobal("fetch", fetchMock);

    const updates: Array<Record<string, unknown>> = [];

    const db = {
      rpc: vi.fn(async () => ({
        data: [{
          id: "cancel-event-001",
          user_id: "customer-001",
          event_type: "needs_customer_info",
          payload: {
            order_id: "a061c307-3e6a-4233-b014-d4da3e4a0426",
          },
          attempts: 1,
        }],
        error: null,
      })),

      from: vi.fn((table: string) => {
        if (table === "profiles" || table === "notification_preferences") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "orders") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "a061c307-3e6a-4233-b014-d4da3e4a0426",
                    user_id: "customer-001",
                    status: "needs_customer_info",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "notification_outbox") {
          return {
            update: (row: Record<string, unknown>) => ({
              eq: async () => {
                updates.push(row);
                return { error: null };
              },
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    mocks.createAdminClient.mockReturnValue(db);

    const { GET } = await import(
      "../app/api/cron/notifications/route"
    );

    const response = await GET(
      new Request("http://localhost/api/cron/notifications", {
        headers: {
          Authorization: "Bearer test-secret",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe("sent");
    expect(updates[0].last_error).toBeNull();
  });
});


