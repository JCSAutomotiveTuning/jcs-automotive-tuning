import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
describe("dealer application review is admin gated and price-safe",()=>{
 it("checks authenticated administrator before accessing dealer records",()=>{
  const s=readFileSync("app/api/admin/dealer-applications/route.ts","utf8");
  expect(s).toContain('p.data?.role!=="admin"');
  expect(s).toContain('auth.response)return auth.response');
  expect(s).toContain('.eq("status","pending")');
 });
 it("does not mutate customer roles, wallets or prices when approving",()=>{
  const s=readFileSync("app/api/admin/dealer-applications/route.ts","utf8");
  expect(s).not.toContain("customer_wallets");
  expect(s).not.toContain('from("profiles").update');
  expect(s).not.toContain("pricing");
 });
});
