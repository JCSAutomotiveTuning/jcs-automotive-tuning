import { afterEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mock.createAdminClient,
}));

describe("Real notification worker SMS safety", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    mock.createAdminClient.mockReset();
  });

  it("requires reconciliation and never resends after confirmation fails", async () => {
    vi.stubEnv("CRON_SECRET", "isolated-test-secret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test");
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_TEST_ONLY");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "TEST_ONLY");
    vi.stubEnv("TWILIO_FROM_NUMBER", "+447000000001");

    const deliveries = new Map<string, {
      id: string;
      status: string;
    }>();

    const outboxUpdates: string[] = [];
    let claims = 0;

    const event = {
      id: "test-event-001",
      user_id: "test-user-001",
      event_type: "wallet_adjustment",
      payload: { amount_pence: 2000 },
      attempts: 1,
    };

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ sid: "SM_TEST_ACCEPTED" }),
    }));

    vi.stubGlobal("fetch", fetchMock);

    const db = {
      rpc: vi.fn(async () => {
        claims++;
        return {
          data: [event],
          error: null,
        };
      }),

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
            select: (_columns: string) => {
              const filters: Record<string, string> = {};

              const query = {
                eq(field: string, value: string) {
                  filters[field] = value;
                  return query;
                },
                async maybeSingle() {
                  return {
                    data: deliveries.get("sms") ?? null,
                    error: null,
                  };
                },
                then(resolve: (value: unknown) => void) {
                  return Promise.resolve({
                    data: deliveries.has("sms")
                      ? [{ status: deliveries.get("sms")!.status }]
                      : [],
                    error: null,
                  }).then(resolve);
                },
              };

              return query;
            },

            insert: (row: { status: string }) => ({
              select: () => ({
                single: async () => {
                  if (deliveries.has("sms")) {
                    return {
                      data: null,
                      error: { code: "23505" },
                    };
                  }

                  const reserved = {
                    id: "delivery-001",
                    status: row.status,
                  };

                  deliveries.set("sms", reserved);

                  return {
                    data: reserved,
                    error: null,
                  };
                },
              }),
            }),

            update: (row: { status: string }) => {
              const query = {
                eq() {
                  return query;
                },
                select: async () => {
                  if (row.status === "sent") {
                    return {
                      data: null,
                      error: { message: "Simulated database failure" },
                    };
                  }

                  return {
                    data: [{ id: "delivery-001" }],
                    error: null,
                  };
                },
                then(resolve: (value: unknown) => void) {
                  if (row.status === "unknown") {
                    deliveries.set("sms", {
                      id: "delivery-001",
                      status: "unknown",
                    });
                  }

                  return Promise.resolve({
                    error: null,
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
                outboxUpdates.push(row.status);
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
      failed: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(deliveries.get("sms")?.status).toBe("unknown");
    expect(outboxUpdates).toContain("needs_reconciliation");

    const second = await GET(request());

    expect(second.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(outboxUpdates.at(-1)).toBe("needs_reconciliation");
    expect(claims).toBe(2);
  });
});
