import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import Page from "@/app/portal/messages/page";
import ko from "@/i18n/messages/ko.json";

const mocks = vi.hoisted(() => ({ from: vi.fn(), eq: vi.fn(), in: vi.fn(), locale: "ko" }));
vi.mock("@/i18n/get-messages", () => ({ getMessages: async () => ({ messages: ko, locale: mocks.locale }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "proxy1" } } }) }, from: mocks.from }) }));

beforeEach(() => {
  vi.clearAllMocks(); mocks.locale = "ko";
  mocks.from.mockImplementation((table: string) => {
    if (table === "delegation_proxy") {
      let calls = 0;
      const chain = { eq: (...args: unknown[]) => { mocks.eq(...args); return ++calls === 1 ? chain : Promise.resolve({ data: [{ delegation: { id: "d1", name: "VN", event_id: "e1", event: { name: "Forum" } } }], error: null }); } };
      return { select: () => chain };
    }
    const result = table === "consent_policy"
      ? [{ id: "n1", event_id: "e1", notice_body: { ko: "공식 공지", en: "Official notice" }, published_at: "2027-01-01T00:00:00Z" }]
      : [{ id: "p1", name: "Meeting", organizer_delegation_id: "d1", pco_adjust_note: "시간 확인 요청", start_at: null }];
    const chain = { in: (...args: unknown[]) => { mocks.in(...args); return chain; }, eq: mocks.eq, not: () => chain, order: async () => ({ data: result, error: null }) };
    mocks.eq.mockReturnValue(chain);
    return { select: () => chain };
  });
});

it("본인의 활성 대표단만 조회하고 게시 공지·조정 요청을 실제 화면에 연결", async () => {
  const html = renderToStaticMarkup(await Page());
  expect(mocks.eq).toHaveBeenCalledWith("user_id", "proxy1");
  expect(mocks.eq).toHaveBeenCalledWith("status", "ACTIVE");
  expect(mocks.in).toHaveBeenCalledWith("organizer_delegation_id", ["d1"]);
  expect(html).toContain("공식 공지"); expect(html).toContain("시간 확인 요청");
  expect(html).toContain("/portal/delegation/d1#schedule");
});

it("언어 선택에 맞는 행사 안내를 표시", async () => {
  mocks.locale = "en";
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain("Official notice");
  expect(html).not.toContain("공식 공지");
});
