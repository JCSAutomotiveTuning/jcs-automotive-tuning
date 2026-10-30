import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
describe("Customer deposit wallet activity scope",()=>{
 it("restricts wallet history to the signed-in user and a small page",()=>{
  const source=readFileSync("app/dashboard/page.tsx","utf8");
  expect(source).toContain('from("deposit_wallet_events")');
  expect(source).toContain('.eq("user_id",user.id)');
  expect(source).toContain('.limit(8)');
  expect(source).not.toContain('select("stripe_session_id');
 });
 it("renders wallet history only inside existing deposit panel",()=>{
  const source=readFileSync("app/dashboard/DepositWalletPanel.tsx","utf8");
  expect(source).toContain('Recent wallet activity');
  expect(source).toContain("events.map");
 });
});
