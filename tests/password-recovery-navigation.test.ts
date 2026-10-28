import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("customer password recovery navigation", () => {
  it("links login to the customer password-reset flow", () => {
    const source = readFileSync("app/login/page.tsx", "utf8");
    expect(source).toContain('href="/forgot-password"');
    expect(source).toContain("Forgot password?");
  });
  it("uses Supabase recovery email with return to reset-password", () => {
    const source = readFileSync("app/forgot-password/page.tsx", "utf8");
    expect(source).toContain("auth.resetPasswordForEmail(email");
    expect(source).toContain("/reset-password");
    expect(source).toContain("If an account exists");
  });
  it("requires a strong new password before update", () => {
    const source = readFileSync("app/reset-password/page.tsx", "utf8");
    expect(source).toContain("passwordStrengthError(password)");
    expect(source).toContain("auth.updateUser({ password })");
  });
});
