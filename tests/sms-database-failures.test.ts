import { afterEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mock.createAdminClient,
}));

describe("SMS safety during multiple database failures", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    mock.createAdminClient.mockReset();
  });

  it("does not resend when delivery and queue updates fail", async () => {
    vi.stubEnv("CRON_SECRET", "isolated-test-secret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test");
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_TEST_ONLY");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "TEST_ONLY");
    vi.stubEnv("TWILIO_FROM_NUMBER", "+447000000001");

    const event = {
      id: "failure-event-001",
      user_id: "failure-user-001",
      event_type: "wallet_adjustment",
      payload: { amount_pence: 2000 },
      attempts: 1,
    };

    let smsStatus: string | null = null;
    let reservationCount = 0;
    const queueUpdates: string[] = [];

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ sid: "SM_TEST_ACCEPTED" }),
    }));

    vi.stubGlobal("fetch", fetchMock);

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
                  return {
                    data: smsStatus ? { status: smsStatus } : null,
                    error: null,
                  };
                },
                then(resolve: (value: unknown) => void) {
                  return Promise.resolve({
                    data: smsStatus ? [{ status: smsStatus }] : [],
                    error: null,
                  }).then(resolve);
                },
              };
              return query;
            },

            insert: () => ({
              select: () => ({
                single: async () => {
                  reservationCount++;

                  if (smsStatus !== null) {
                    return {
                      data: null,
                      error: { code: "23505" },
                    };
                  }

                  smsStatus = "sending";

                  return {
                    data: { id: "delivery-001" },
                    error: null,
                  };
                },
              }),
            }),

            update: (_row: { status: string }) => {
              const query = {
                eq() {
                  return query;
                },
                select: async () => ({
                  data: null,
                  error: {
                    message: "Simulated delivery confirmation failure",
                  },
                }),
                then(resolve: (value: unknown) => void) {
                  return Promise.resolve({
                    error: {
                      message: "Simulated delivery status update failure",
                    },
                  }).then(resolve);
                },
              };
              return query;
            },
          };
        }

        if (table === "notification_outbox") {
          return {
            update: (row: { status: string }) => ({
              eq: async () => {
                queueUpdates.push(row.status);
                return {
                  error: {
                    message: "Simulated queue update failure",
                  },
                };
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

    const request = () =>
      new Request("http://localhost/api/cron/notifications", {
        headers: {
          Authorization: "Bearer isolated-test-secret",
        },
      });

    const first = await GET(request());

    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      processed: 1,
      sent: 0,
      failed: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(smsStatus).toBe("sending");
    expect(queueUpdates).toContain("needs_reconciliation");

    // Force a second claim to simulate lock expiry.
    const second = await GET(request());

    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({
      sent: 0,
      failed: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reservationCount).toBe(1);
    expect(smsStatus).toBe("sending");
  });
});
