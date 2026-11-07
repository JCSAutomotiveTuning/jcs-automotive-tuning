/**
 * Fail closed for payment checkout configuration.
 * Restricted Stripe keys are valid when their permissions include Checkout Session writes.
 * Production must use live credentials, preview must use test credentials.
 */
export function validatedCheckoutConfiguration(
  key: string | undefined,
  environment: string | undefined,
  configuredSiteUrl: string | undefined
): { ok: true; siteUrl: string } | { ok: false; reason: string } {
  if (!key || !/^(sk|rk)_(test|live)_/.test(key)) {
    return { ok: false, reason: "Stripe secret key missing or unrecognised." };
  }
  if (environment === "production" && !/^(sk|rk)_live_/.test(key)) {
    return { ok: false, reason: "Production requires live Stripe credentials." };
  }
  if (environment === "preview" && !/^(sk|rk)_test_/.test(key)) {
    return { ok: false, reason: "Preview requires Stripe test credentials." };
  }

  if (!configuredSiteUrl) {
    return { ok: false, reason: "A trusted payment return URL is required." };
  }
  try {
    const parsed = new URL(configuredSiteUrl.trim());
    const localhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if ((parsed.protocol !== "https:" && !(environment !== "production" && environment !== "preview" && localhost && parsed.protocol === "http:")) ||
      parsed.username || parsed.password || parsed.search || parsed.hash ||
      (parsed.pathname !== "/" && parsed.pathname !== "")) {
      return { ok: false, reason: "Untrusted payment return URL." };
    }
    return { ok: true, siteUrl: parsed.origin };
  } catch {
    return { ok: false, reason: "Invalid payment return URL." };
  }
}
