import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import RosterPage from "@/app/console/events/[id]/roster/page";
import { ServiceCell } from "@/components/console/delegation-matrix";

const mocks = vi.hoisted(() => ({ eq: vi.fn(), order: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => ({ select: () => ({ eq: mocks.eq }) }) }) }));

it("행사 범위 안에서 이름을 검색하고 대표단 상세에 연결", async () => {
  mocks.eq.mockReturnValue({ order: mocks.order });
  mocks.order.mockResolvedValue({ data: [{ id: "d1", name: "VN Team", participant: [
    { id: "p1", first_name: "Demo", last_name: "Kim", participant_type: "VIP", nationality: "VN", sort_order: 0 },
    { id: "p2", first_name: "Other", last_name: "Lee", participant_type: "STAFF", nationality: "VN", sort_order: 1 },
  ], service_item: [] }], error: null });
  const html = renderToStaticMarkup(await RosterPage({ params: Promise.resolve({ id: "event1" }), searchParams: Promise.resolve({ q: "kim" }) }));
  expect(mocks.eq).toHaveBeenCalledWith("event_id", "event1");
  expect(html).toContain("Kim");
  expect(html).not.toContain("Other");
  expect(html).toContain("/console/events/event1/delegations/d1");
});

it("자체 일정 수송을 귀국으로 잘못 표시하지 않음", () => {
  const html = renderToStaticMarkup(createElement(ServiceCell, { participantId: "p1", items: [{ id: "s1", service_type: "TRANSFER", status: "REQUESTED", transfer_request: { direction: "PROGRAM", participant_ids: ["p1"] } }] }));
  expect(html).toContain("일정");
  expect(html).not.toContain("귀국");
});
