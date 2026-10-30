import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
describe("bank transfer payments",()=>{
 it("never lets customers mark an order paid",()=>{
  const s=readFileSync("app/api/orders/bank-transfer/route.ts","utf8");
  expect(s).not.toContain('payment_status:"paid"');
  expect(s).toContain('.eq("user_id",user.id)');
  expect(s).toContain('status!=="awaiting_payment"');
 });
 it("admin checks role and records bank reference through a transactional RPC",()=>{
  const s=readFileSync("app/api/admin/orders/bank-transfer/route.ts","utf8");
  expect(s).toContain('profile?.role!=="admin"');
  expect(s).toContain('confirm_manual_bank_transfer');
 });
 it("database checks balance and keeps ledger audit in same transaction",()=>{
  const s=readFileSync("supabase/migrations/20261030_manual_bank_transfer.sql","utf8");
  expect(s).toContain("for update");
  expect(s).toContain("ord.amount_pence-coalesce(ord.deposit_pence,0)");
  expect(s).toContain("order_audit");
  expect(s).toContain("auth.role() <> 'service_role'");
 });
});
