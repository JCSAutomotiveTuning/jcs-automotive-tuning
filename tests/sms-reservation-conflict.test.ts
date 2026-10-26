import { afterEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mock.createAdminClient,
}));

describe("SMS reservation conflict safety", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    mock.createAdminClient.mockReset();
  });

  it("does not send SMS when another worker owns the reservation", async () => {
    vi.stubEnv("CRON_SECRET", "isolated-test-secret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test");

    const fetchMock = vi.fn(() => {
      throw new Error("External network access forbidden");
    });

    vi.stubGlobal("fetch", fetchMock);

    const queueUpdates: string[] = [];
    let reservationAttempts = 0;

    const event = {
      id: "conflict-event-001",
      user_id: "conflict-user-001",
      event_type: "wallet_adjustment",
      payload: { amount_pence: 2000 },
      attempts: 1,
    };

    const db = {
      rpc: vi.fn(async () => ({
        data: [event],
        error: null,
      })),

      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { email: null },
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
                    email_enabled: false,
                    sms_enabled: true,
                    phone_e164: "+447000000000",
                    phone_verified_at: "2026-10-26T00:00:00Z",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "notification_deliveries") {
          return {
            select: () => {
              const query = {
                eq() {
                  return query;
                },
                async maybeSingle() {
                  return { data: null, error: null };
                },
                then(resolve: (value: unknown) => void) {
                  return Promise.resolve({
                    data: [{ status: "sending" }],
                    error: null,
                  }).then(resolve);
                },
              };

              return query;
            },

            insert: () => ({
              select: () => ({
                single: async () => {
                  reservationAttempts++;

                  return {
                    data: null,
                    error: {
                      code: "23505",
                      message: "Unique constraint violation",
                    },
                  };
                },
              }),
            }),
          };
        }

        if (table === "notification_outbox") {
          return {
            update: (row: { status: string }) => ({
              eq: async () => {
                queueUpdates.push(row.status);
                return { error: null };
              },
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    mock.createAdminClient.mockReturnValue(db);

    const { GET } = await import(
      "../app/api/cron/notifications/route"
    );

    const response = await GET(
      new Request("http://localhost/api/cron/notifications", {
        headers: {
          Authorization: "Bearer isolated-test-secret",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      processed: 1,
      sent: 0,
      failed: 1,
    });

    expect(reservationAttempts).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(queueUpdates).toContain("needs_reconciliation");
  });
});
