import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import Page from "@/app/admin/page";
import { demoId } from "../scripts/demo-data.mjs";

const mocks = vi.hoisted(() => ({ role: "PLATFORM_ADMIN", demo: true, select: vi.fn(), eq: vi.fn(), from: vi.fn(), health: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: mocks.role }) }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/lib/demo", () => ({ isDemoMode: () => mocks.demo }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ auth: { admin: { listUsers: mocks.health } }, from: mocks.from }) }));

beforeEach(() => {
  vi.clearAllMocks(); mocks.role = "PLATFORM_ADMIN"; mocks.demo = true;
  mocks.health.mockResolvedValue({ data: { users: [{ email: "private@example.com" }] }, error: null });
  mocks.from.mockReturnValue({ select: mocks.select }); mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ count: 3, error: null });
});

it("운영 현황은 데모 조직 건수만 조회하고 계정 정보는 출력하지 않음", async () => {
  const html = renderToStaticMarkup(await Page());
  expect(mocks.eq).toHaveBeenCalledWith("tenant_id", demoId("tenant"));
  expect(mocks.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
  expect(html).not.toContain("private@example.com");
});

it("일반 모드에서는 임시 로그인에 조직 현황을 제공하지 않음", async () => {
  mocks.demo = false; await Page(); expect(mocks.from).not.toHaveBeenCalled();
});

it("운영자 쿠키가 없으면 서버에서 입장을 차단", async () => {
  mocks.role = "";
  await expect(Page()).rejects.toThrow("redirect:/login");
  expect(mocks.health).not.toHaveBeenCalled();
});
