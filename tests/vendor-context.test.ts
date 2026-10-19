import { beforeEach, expect, it, vi } from "vitest";
import { getVendorContext } from "@/server/auth/vendor-context";
import { demoId } from "../scripts/demo-data.mjs";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), eq: vi.fn(), from: vi.fn(), order: vi.fn(), serviceEq: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user", email: "choby.pm+demo-vendor@gmail.com", app_metadata: { demo_seed: "mice-invi-v1" } } }, error: null });
  mocks.eq.mockResolvedValue({ data: ["FLIGHT", "LODGING"].map((type) => ({ role: "ADMIN", vendor: { id: demoId(`vendor:${type}`), name: type } })), error: null });
  const serviceQuery = { eq: mocks.serviceEq, order: mocks.order };
  mocks.serviceEq.mockReturnValue(serviceQuery);
  mocks.from.mockImplementation((table: string) => ({ select: () => table === "vendor_member" ? { eq: mocks.eq } : serviceQuery }));
  mocks.order.mockResolvedValue({ data: [
    { event_vendor_id: "assignment", service_type: "FLIGHT", event: { id: "event", name: "Demo", status: "ACTIVE" } },
    { event_vendor_id: "assignment", service_type: "FLIGHT", event: { id: "event", name: "Demo", status: "ACTIVE" } },
  ], error: null });
});

it("업체 데모는 자기 항공 소속과 행사로 표시 범위를 좁힘", async () => {
  const result = await getVendorContext();
  expect(mocks.eq).toHaveBeenCalledWith("user_id", "user");
  expect(result.memberships.map((m) => m.vendor.name)).toEqual(["FLIGHT"]);
  expect(mocks.serviceEq).toHaveBeenCalledWith("service_type", "FLIGHT");
  expect(result.assignments).toHaveLength(1);
  expect(result.assignments[0].service_types).toEqual(["FLIGHT"]);
  expect(mocks.from).not.toHaveBeenCalledWith("event_vendor");
});

it("일반 업체 계정의 다른 분야 소속은 유지", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user", email: "normal@example.com", app_metadata: {} } }, error: null });
  expect((await getVendorContext()).memberships).toHaveLength(2);
});

it("세션 없음과 조회 오류를 빈 업무로 숨기지 않음", async () => {
  mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  await expect(getVendorContext()).rejects.toThrow("redirect:/vendor-login");
  mocks.eq.mockResolvedValueOnce({ data: null, error: new Error("query failed") });
  await expect(getVendorContext()).rejects.toThrow("query failed");
});
