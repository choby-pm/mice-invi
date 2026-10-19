import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), createServerClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createServerClient.mockReturnValue({ auth: { getClaims: mocks.getClaims } });
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "verified-user" } }, error: null });
});

describe("페이지 접근 시 서명 검증과 세션 갱신", () => {
  it.each(["console", "vendor", "portal"])("%s는 검증된 claims로 통과", async (section) => {
    const response = await proxy(new NextRequest(`https://demo.example/${section}`));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.getClaims).toHaveBeenCalledOnce();
  });

  it.each(["console", "vendor", "portal"])("%s의 세션 누락은 로그인 화면으로 이동", async (section) => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    const response = await proxy(new NextRequest(`https://demo.example/${section}`));
    expect(response.headers.get("location")).toBe(`https://demo.example/${section}-login`);
  });

  it("서명 검증 실패는 claims가 있어도 차단", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "untrusted" } }, error: new Error("invalid signature") });
    const response = await proxy(new NextRequest("https://demo.example/console"));
    expect(response.headers.get("location")).toBe("https://demo.example/console-login");
  });

  it("갱신 쿠키를 현재 요청과 브라우저 응답에 모두 전달", async () => {
    const request = new NextRequest("https://demo.example/portal");
    mocks.getClaims.mockImplementation(async () => {
      const config = mocks.createServerClient.mock.calls[0][2];
      config.cookies.setAll([{ name: "test-session", value: "refreshed", options: { path: "/", httpOnly: true } }]);
      return { data: { claims: { sub: "verified-user" } }, error: null };
    });
    const response = await proxy(request);
    expect(request.cookies.get("test-session")?.value).toBe("refreshed");
    expect(response.cookies.get("test-session")).toMatchObject({ value: "refreshed", httpOnly: true });
  });
});
