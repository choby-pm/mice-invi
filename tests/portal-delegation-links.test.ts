import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DelegationLinks } from "@/components/portal/delegation-links";
import ko from "@/i18n/messages/ko.json";

const mocks = vi.hoisted(() => ({ eq: vi.fn(), select: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: mocks.from }) }));
vi.mock("@/i18n/get-messages", () => ({ getMessages: async () => ({ messages: ko }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ data: [{ delegation: { id: "assigned", name: "Demo", organization: "PCO", event: { name: "Forum" } } }], error: null });
});

it.each(["flight", "schedule"] as const)("%s 메뉴는 배정된 대표단의 실제 기능에 연결", async (section) => {
  const html = renderToStaticMarkup(await DelegationLinks({ section }));
  expect(html).toContain(`/portal/delegation/assigned#${section}`);
  expect(mocks.from).toHaveBeenCalledWith("delegation_proxy");
  expect(mocks.eq).toHaveBeenCalledWith("status", "ACTIVE");
});

it("체크리스트는 기존 대표단 주소를 유지", async () => {
  const html = renderToStaticMarkup(await DelegationLinks({}));
  expect(html).toContain('href="/portal/delegation/assigned"');
});

it("배정 없음과 연결 오류를 구분", async () => {
  mocks.eq.mockResolvedValueOnce({ data: [], error: null });
  expect(renderToStaticMarkup(await DelegationLinks({}))).toContain(ko.portal.noDelegations);
  const error = new Error("DB unavailable");
  mocks.eq.mockResolvedValueOnce({ data: null, error });
  await expect(DelegationLinks({})).rejects.toThrow(error);
});
