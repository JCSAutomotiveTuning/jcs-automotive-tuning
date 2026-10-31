import {beforeEach, describe, expect, it, vi} from "vitest";

const ids = {
  user: "70993cc7-1f32-49db-ba62-e7fd858108e8",
  other: "31d611a7-ff78-4909-a9d0-e081ea58010f",
  order: "75a7d229-a462-4ff0-83d4-729fbe44445a",
  file: "e7eaa751-7e97-4963-aee3-883f989d6fce",
};
const state = vi.hoisted(() => ({
  auth: vi.fn(), file: vi.fn(), order: vi.fn(), signed: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: state.auth } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: table === "order_files" ? state.file : state.order }),
        }),
      }),
    }),
    storage: {from: () => ({createSignedUrl: state.signed})},
  }),
}));
const original = () => ({
  id: ids.file, order_id: ids.order, user_id: ids.user,
  kind: "completed_output", scan_status: "clean", delivery_status: "approved",
  storage_path: `${ids.user}/${ids.order}/completed/test-file.bin`,
  original_filename: "finished.bin",
});
async function invoke() {
  const {GET} = await import("@/app/api/orders/files/[id]/download/route");
  return GET(new Request(`https://example.invalid/api/orders/files/${ids.file}/download`), {params:Promise.resolve({id:ids.file})});
}
describe("Finished ECU/TCU file customer isolation (mocked, no real files)", () => {
  beforeEach(() => {
    state.auth.mockReset().mockResolvedValue({data:{user:{id:ids.user}},error:null});
    state.file.mockReset().mockResolvedValue({data:original(),error:null});
    state.order.mockReset().mockResolvedValue({data:{id:ids.order,user_id:ids.user,status:"completed",payment_status:"paid"},error:null});
    state.signed.mockReset().mockResolvedValue({data:{signedUrl:"https://example.invalid/secure-download"},error:null});
  });
  it("requires sign-in", async () => {
    state.auth.mockResolvedValueOnce({data:{user:null},error:null});
    expect((await invoke()).status).toBe(401);
    expect(state.signed).not.toHaveBeenCalled();
  });
  it("never signs another customer's original or completed file", async () => {
    state.file.mockResolvedValueOnce({data:null,error:null});
    expect((await invoke()).status).toBe(404);
    expect(state.signed).not.toHaveBeenCalled();
  });
  it("blocks pending scan and missing delivery approval", async () => {
    state.file.mockResolvedValueOnce({data:{...original(),scan_status:"pending"},error:null});
    expect((await invoke()).status).toBe(409);
    state.file.mockResolvedValueOnce({data:{...original(),delivery_status:"pending"},error:null});
    expect((await invoke()).status).toBe(409);
    expect(state.signed).not.toHaveBeenCalled();
  });
  it("blocks unpaid or unfinished orders", async () => {
    state.order.mockResolvedValueOnce({data:{status:"qa_review",payment_status:"paid"},error:null});
    expect((await invoke()).status).toBe(409);
    state.order.mockResolvedValueOnce({data:{status:"completed",payment_status:"unpaid"},error:null});
    expect((await invoke()).status).toBe(409);
    expect(state.signed).not.toHaveBeenCalled();
  });
  it("signs only fully cleared, approved, paid, completed customer files", async () => {
    const result=await invoke();
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toContain("no-store");
    expect(state.signed).toHaveBeenCalledWith(original().storage_path,60,{download:"finished.bin"});
  });
});
