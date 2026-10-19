import { beforeEach, expect, it, vi } from "vitest";
import { saveProtocolLevel, saveSupportPolicy } from "@/server/modules/event/settings-actions";

const mocks = vi.hoisted(() => ({ membership: vi.fn(), from: vi.fn(), update: vi.fn(), insert: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/server/modules/org/get-membership", () => ({ getCurrentMembership: mocks.membership }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: mocks.from }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.membership.mockResolvedValue({ role: "PCO_MANAGER", tenantId: "tenant1" });
  const chain = { eq: mocks.eq, select: mocks.select, maybeSingle: mocks.maybeSingle, single: mocks.maybeSingle, update: mocks.update, insert: mocks.insert };
  for (const fn of [mocks.from, mocks.update, mocks.insert, mocks.eq, mocks.select]) fn.mockReturnValue(chain);
  mocks.maybeSingle.mockResolvedValue({ data: { id: "event1" }, error: null });
});

function policyForm() {
  const form = new FormData();
  for (const [k, v] of Object.entries({ eventId: "event1", id: "policy1", serviceType: "FLIGHT", participantType: "VIP", supportType: "SUPPORTED", maxCount: "", guideKo: "안내" })) form.set(k, v);
  return form;
}

it("현장 직원은 서버에서 저장이 차단됨", async () => {
  mocks.membership.mockResolvedValue({ role: "PCO_FIELD", tenantId: "tenant1" });
  await expect(saveSupportPolicy(policyForm())).rejects.toThrow("&error=");
  expect(mocks.from).not.toHaveBeenCalled();
});

it("관리자·담당자는 소속 행사와 정책으로 범위를 제한해 저장", async () => {
  await expect(saveSupportPolicy(policyForm())).rejects.toThrow("saved=1");
  expect(mocks.eq).toHaveBeenCalledWith("tenant_id", "tenant1");
  expect(mocks.eq).toHaveBeenCalledWith("event_id", "event1");
  expect(mocks.eq).toHaveBeenCalledWith("id", "policy1");
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ max_count: null, service_type: "FLIGHT", guide_text: { ko: "안내", en: "" } }));
});

it.each(["-1", "1.5", "abc", "2147483648"])("잘못된 인원 한도 %s는 저장하지 않음", async (count) => {
  const form = policyForm(); form.set("maxCount", count);
  await expect(saveSupportPolicy(form)).rejects.toThrow("&error=");
  expect(mocks.update).not.toHaveBeenCalled();
});

it("다른 조직의 행사 또는 영향받은 행이 없는 저장은 성공으로 표시하지 않음", async () => {
  mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
  await expect(saveSupportPolicy(policyForm())).rejects.toThrow("&error=");
  expect(mocks.update).not.toHaveBeenCalled();
  mocks.maybeSingle.mockResolvedValueOnce({ data: { id: "event1" }, error: null }).mockResolvedValueOnce({ data: null, error: null });
  await expect(saveSupportPolicy(policyForm())).rejects.toThrow("&error=");
});

it("의전 등급 수정은 기존 기본값을 덮어쓰지 않음", async () => {
  const form = new FormData();
  for (const [k, v] of Object.entries({ eventId: "event1", id: "level1", name: " VIP ", sortOrder: "2" })) form.set(k, v);
  await expect(saveProtocolLevel(form)).rejects.toThrow("saved=1");
  expect(mocks.update).toHaveBeenCalledWith({ name: "VIP", sort_order: 2 });
});
