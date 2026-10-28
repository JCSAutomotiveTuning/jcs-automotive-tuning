import { describe, expect, it } from "vitest";
import { COUNTRIES } from "../lib/countries";
import { readFileSync } from "node:fs";

describe("Registration country dropdown", () => {
  it("includes the complete ISO 3166-1 country and territory list", () => {
    expect(COUNTRIES).toHaveLength(249);
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(249);
    expect(COUNTRIES.find((c) => c.code === "GB")?.name).toBe("United Kingdom");
    expect(COUNTRIES.find((c) => c.code === "US")?.name).toBe("United States");
  });

  it("submits a named country and defaults to the United Kingdom", () => {
    const page = readFileSync("app/register/page.tsx", "utf8");
    expect(page).toContain('name="country"');
    expect(page).toContain('defaultValue="United Kingdom"');
    expect(page).toContain("COUNTRIES.map");
    expect(page).toContain("country:val(\"country\")");
  });
});
