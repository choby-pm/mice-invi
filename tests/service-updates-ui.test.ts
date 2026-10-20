import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ServiceUpdates } from "@/components/shared/service-updates";
const mocks = vi.hoisted(() => ({ eq: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => ({ select: () => query }) }) }));
const query = { eq: mocks.eq, order: () => query, limit: mocks.limit };
beforeEach(() => {
  mocks.eq.mockReturnValue(query);
  mocks.limit.mockResolvedValue({ data: [{ id: "update", kind: "REQUEST", before_text: '{"note":"old"}', after_text: '{"note":"new"}', created_at: "2026-01-01T00:00:00Z", due_at: "2026-01-02T00:00:00Z", vendor_ack_at: null, service_update_receipt: [], service_item: { id: "service", event_id: "event", delegation_id: "own", service_type: "FLIGHT", status: "CHANGING", delegation: { name: "Own delegation" } } }], error: null });
});
it("PCO는 변경 전후·업체 미확인·기한 초과를 확인", async () => {
  const html = renderToStaticMarkup(await ServiceUpdates({ audience: "console", eventId: "event" }));
  expect(mocks.eq).toHaveBeenCalledWith("service_item.event_id", "event");
  for (const text of ["old", "new", "담당 업체 확인 대기", "업체 확인 기한 초과", "/console/events/event/delegations/own"]) expect(html).toContain(text);
});
it("VIP는 자기 대표단 필터와 영어 안내를 사용", async () => {
  const html = renderToStaticMarkup(await ServiceUpdates({ audience: "portal", delegationId: "own", locale: "en" }));
  expect(mocks.eq).toHaveBeenCalledWith("service_item.delegation_id", "own");
  expect(html).toContain("Acknowledge update"); expect(html).not.toContain("업체 확인 기한 초과");
  expect(html).toContain("/portal/delegation/own#flight");
});
it("DB 오류를 빈 변경함으로 숨기지 않음", async () => {
  mocks.limit.mockResolvedValue({ data: null, error: { message: "offline" } });
  await expect(ServiceUpdates({ audience: "vendor" })).rejects.toThrow("변경 안내를 불러오지 못했습니다.");
});
