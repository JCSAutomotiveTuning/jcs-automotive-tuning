import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

describe("Cancellation notification email", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    mocks.createAdminClient.mockReset();
  });

  it("sends the correct cancellation message through mocked Resend", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test");
    vi.stubEnv("RESEND_API_KEY", "fake-test-key");
    vi.stubEnv("NOTIFICATION_FROM_EMAIL", "test@example.test");

    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      expect(url).toBe("https://api.resend.com/emails");

      const payload = JSON.parse(String(options.body));

      expect(payload.to).toBe("customer@example.test");
      expect(payload.subject).toContain("cancelled");
      expect(payload.text).toContain("cancelled");
      expect(payload.text).toContain("https://example.test/dashboard");

      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "mock-email-001" }),
      };
    });

    vi.stubGlobal("fetch", fetchMock);

    const updates: Array<Record<string, unknown>> = [];

    const db = {
      rpc: vi.fn(async () => ({
        data: [{
          id: "cancel-email-event",
          user_id: "customer-001",
          event_type: "order_cancelled",
          payload: {
            order_id: "148dc8cc-1b8a-4ecd-980a-4bf5db616131",
          },
          attempts: 1,
        }],
        error: null,
      })),

      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { email: "customer@example.test" },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "notification_preferences") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    email_enabled: true,
                    sms_enabled: false,
                    phone_e164: null,
                    phone_verified_at: null,
                  },
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
                    id: "148dc8cc-1b8a-4ecd-980a-4bf5db616131",
                    user_id: "customer-001",
                    status: "cancelled",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "notification_deliveries") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
            upsert: async () => ({ error: null }),
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
        headers: { Authorization: "Bearer test-secret" },
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      processed: 1,
      sent: 1,
      failed: 0,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updates[0].status).toBe("sent");
  });
});
