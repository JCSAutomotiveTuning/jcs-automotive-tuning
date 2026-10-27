import { afterEach, describe, expect, it, vi } from "vitest";
import { MIN_PASSWORD_LENGTH, isKnownCompromisedPassword, passwordStrengthError } from "@/lib/password-security";

describe("Customer password defence in depth", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("enforces the same minimum length on registration and reset", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
    expect(passwordStrengthError("short")).not.toBeNull();
    expect(passwordStrengthError("correct horse battery staple")).toBeNull();
    expect(passwordStrengthError("x".repeat(129))).not.toBeNull();
  });

  it("sends only a SHA-1 prefix and rejects breached passwords", async () => {
    const suffix = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";
    const request = vi.fn(async () => new Response(`${suffix}:123\r\n00000000000000000000000000000000000:0`, { status: 200 }));
    vi.stubGlobal("fetch", request);

    expect(await isKnownCompromisedPassword("password")).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    const [url, opts] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.pwnedpasswords.com/range/5BAA6");
    expect(url).not.toContain("password");
    expect(opts.headers).toEqual({ "Add-Padding": "true" });
  });

  it("treats breach-provider downtime as an error rather than declaring the password safe", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
    await expect(isKnownCompromisedPassword("secret phrase")).rejects.toThrow(/temporarily unavailable/);
  });
});
