import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("customer password recovery navigation", () => {
  it("links login to the customer password-reset flow", () => {
    const source = readFileSync("app/login/page.tsx", "utf8");
    expect(source).toContain('href="/forgot-password"');
    expect(source).toContain("Forgot password?");
  });
  it("uses Supabase recovery email with a server-side verification callback", () => {
    const source = readFileSync("app/forgot-password/page.tsx", "utf8");
    expect(source).toContain("auth.resetPasswordForEmail(email");
    expect(source).toContain("/auth/confirm");
    expect(source).toContain("If an account exists");
  });
  it("handles recovery token hash server-side with cookie storage", () => {
    const source = readFileSync("app/auth/confirm/route.ts", "utf8");
    expect(source).toContain("auth.verifyOtp");
    expect(source).toContain("token_hash");
    expect(source).toContain("/reset-password");
  });
  it("requires a strong new password before update", () => {
    const source = readFileSync("app/reset-password/page.tsx", "utf8");
    expect(source).toContain("passwordStrengthError(password)");
    expect(source).toContain("auth.updateUser({ password })");
  });
});
