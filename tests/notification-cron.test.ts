import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    throw new Error("Database access forbidden in this test");
  }),
}));

describe("Notification cron security", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects requests without authorization", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret-not-real");

    const { GET } = await import(
      "../app/api/cron/notifications/route"
    );

    const response = await GET(
      new Request("http://localhost/api/cron/notifications")
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Unauthorized",
    });
  });

  it("rejects an incorrect authorization token", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret-not-real");

    const { GET } = await import(
      "../app/api/cron/notifications/route"
    );

    const response = await GET(
      new Request("http://localhost/api/cron/notifications", {
        headers: {
          Authorization: "Bearer incorrect-token",
        },
      })
    );

    expect(response.status).toBe(401);
  });
});
