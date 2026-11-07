import { describe, expect, it } from "vitest";
import { validatedCheckoutConfiguration as validate } from "@/lib/stripe-checkout-configuration";
const site = "https://jcs-automotive-tuning.vercel.app";

describe("Stripe checkout configuration", () => {
  it("accepts live standard and restricted keys in production", () => {
    for (const key of ["sk_live_example", "rk_live_example"]) {
      expect(validate(key, "production", site)).toEqual({ ok: true, siteUrl: site });
    }
  });

  it("rejects test credentials in production and live credentials in preview", () => {
    expect(validate("sk_test_example", "production", site).ok).toBe(false);
    expect(validate("rk_test_example", "production", site).ok).toBe(false);
    expect(validate("sk_live_example", "preview", site).ok).toBe(false);
    expect(validate("rk_live_example", "preview", site).ok).toBe(false);
  });

  it("accepts test restricted and standard keys in preview", () => {
    for (const key of ["sk_test_example", "rk_test_example"]) {
      expect(validate(key, "preview", site).ok).toBe(true);
    }
  });

  it("does not fall back to a request-provided origin", () => {
    expect(validate("sk_live_example", "production", undefined).ok).toBe(false);
    expect(validate("sk_live_example", "production", "").ok).toBe(false);
  });

  it("rejects URLs with credentials, query, fragments, paths or insecure schemes", () => {
    for (const url of [
      "http://jcs-automotive-tuning.vercel.app",
      "https://evil.example/path",
      "https://user:password@jcs-automotive-tuning.vercel.app",
      "https://jcs-automotive-tuning.vercel.app/?redirect=evil",
      "https://jcs-automotive-tuning.vercel.app/#fragment",
      "javascript:alert(1)",
    ]) {
      expect(validate("sk_live_example", "production", url).ok).toBe(false);
    }
  });

  it("allows local http only for development", () => {
    expect(validate("sk_test_example", "development", "http://localhost:3000").ok).toBe(true);
    expect(validate("sk_test_example", "preview", "http://localhost:3000").ok).toBe(false);
    expect(validate("sk_live_example", "production", "http://127.0.0.1:3000").ok).toBe(false);
  });

  it("strips trailing slash and returns the trusted HTTPS site origin", () => {
    expect(validate("rk_live_example", "production", site + "/")).toEqual({
      ok: true, siteUrl: site,
    });
  });
});
