import { beforeEach, describe, expect, it, vi } from "vitest";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  adminRole: vi.fn(),
  fileRow: vi.fn(),
  requestRow: vi.fn(),
  sign: vi.fn(),
}));
vi.mock("@/lib/technical-requests", () => ({
  technicalUser: mocks.user,
  technicalAdmin: mocks.adminRole,
  uuidPattern: /^[0-9a-f-]{36}$/i,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => table === "technical_request_files" ? mocks.fileRow() : mocks.requestRow(),
        }),
      }),
    }),
    storage: { from: () => ({ createSignedUrl: mocks.sign }) },
  }),
}));
const fileId = "00000000-0000-4000-8000-000000000003";
async function download() {
  const { GET } = await import("@/app/api/technical-requests/files/[fileId]/route");
  return GET(new Request("http://localhost/api/technical-requests/files/" + fileId), {
    params: Promise.resolve({ fileId }),
  });
}
describe("Technical deliverable ownership and malware gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue({ id: other });
    mocks.adminRole.mockResolvedValue(false);
    mocks.fileRow.mockResolvedValue({ data: {
      storage_path: "request/deliverable.bin",
      request_id: fileId,
      scan_status: "clean",
    }, error: null });
    mocks.requestRow.mockResolvedValue({ data: {
      user_id: owner, payment_status: "paid", status: "completed",
    }, error: null });
    mocks.sign.mockResolvedValue({ data: { signedUrl: "https://example.invalid/private" }, error: null });
  });
  it("denies another customer's completed paid file", async () => {
    expect((await download()).status).toBe(404);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("denies even the owner when payment is unpaid", async () => {
    mocks.user.mockResolvedValue({ id: owner });
    mocks.requestRow.mockResolvedValue({ data: {
      user_id: owner, payment_status: "unpaid", status: "completed",
    }, error: null });
    expect((await download()).status).toBe(404);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("denies malware-pending files even to the owner", async () => {
    mocks.user.mockResolvedValue({ id: owner });
    mocks.fileRow.mockResolvedValue({ data: {
      storage_path: "request/deliverable.bin",
      request_id: fileId,
      scan_status: "pending",
    }, error: null });
    expect((await download()).status).toBe(403);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
});
