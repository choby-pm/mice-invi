import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoId } from "../scripts/demo-data.mjs";
import { assertDemoAccount } from "@/server/auth/demo-account";
import { demoLogin } from "@/server/auth/demo-login";
import { DEMO_ROLES, DEMO_TAB_COOKIE, demoTabRole, isDemoMode, type DemoRole } from "@/lib/demo";
import { logInPco, logOutPco, signUpPco } from "@/server/modules/iam/auth-actions";
import { logInVendor, vendorLogout } from "@/server/modules/iam/vendor-auth-actions";
import { portalLogout, requestPortalOtp, verifyPortalOtp } from "@/server/modules/iam/portal-auth-actions";

const mocks = vi.hoisted(() => ({
  demoSessionCookies: vi.fn(),
  setCookie: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/server/auth/demo-session", () => ({ demoSessionCookies: mocks.demoSessionCookies }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.setCookie }) }));

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "true");
  vi.clearAllMocks();
  mocks.demoSessionCookies.mockResolvedValue([{ name: "sb-test-auth-token", value: "server-held" }]);
});
afterEach(() => vi.unstubAllEnvs());

function identity(role: DemoRole) {
  return { email: `choby.pm+demo-${role}@gmail.com`, app_metadata: { demo_seed: "mice-invi-v1" } };
}

describe("데모 계정 범위", () => {
  it.each(["pco", "manager", "field"] as const)("%s는 지정된 조직과 역할만 사용", (role) => {
    const expected = { pco: "PCO_ADMIN", manager: "PCO_MANAGER", field: "PCO_FIELD" }[role];
    expect(() => assertDemoAccount(role, identity(role), [{ tenant_id: demoId("tenant"), role: expected }], [], [])).not.toThrow();
    expect(() => assertDemoAccount(role, identity(role), [{ tenant_id: demoId("other-tenant"), role: expected }], [], [])).toThrow();
    expect(() => assertDemoAccount(role, identity(role), [{ tenant_id: demoId("tenant"), role: "UNEXPECTED" }], [], [])).toThrow();
  });

  it("업체·대리인은 데모 업체와 대표단에만 연결 가능", () => {
    expect(() => assertDemoAccount("vendor", identity("vendor"), [], [{ vendor_id: demoId("vendor:FLIGHT") }], [])).not.toThrow();
    expect(() => assertDemoAccount("proxy", identity("proxy"), [], [], [{ delegation_id: demoId("delegation:VN") }])).not.toThrow();
    expect(() => assertDemoAccount("vendor", identity("vendor"), [], [{ vendor_id: demoId("real-vendor") }], [])).toThrow();
    expect(() => assertDemoAccount("proxy", identity("proxy"), [], [], [{ delegation_id: demoId("real-delegation") }])).toThrow();
  });

  it.each(["vendor-lodging", "vendor-transfer", "vendor-airport", "vendor-dietary"] as const)("%s는 자기 분야 데모 업체에만 연결", (role) => {
    const own = { vendor_id: demoId(`vendor:${role.slice(7).toUpperCase()}`) }, flight = { vendor_id: demoId("vendor:FLIGHT") };
    expect(() => assertDemoAccount(role, identity(role), [], [own], [])).not.toThrow();
    expect(() => assertDemoAccount(role, identity(role), [], [flight], [])).toThrow();
    expect(() => assertDemoAccount(role, identity(role), [], [own, flight], [])).toThrow();
    expect(() => assertDemoAccount(role, identity("vendor"), [], [own], [])).toThrow();
  });

  it("항공 데모 계정의 다른 분야 단독·복수 소속은 거부", () => {
    const flight = { vendor_id: demoId("vendor:FLIGHT") }, lodging = { vendor_id: demoId("vendor:LODGING") };
    expect(() => assertDemoAccount("vendor", identity("vendor"), [], [lodging], [])).toThrow();
    expect(() => assertDemoAccount("vendor", identity("vendor"), [], [flight, lodging], [])).toThrow();
  });

  it("이메일만 맞는 일반 계정이나 다른 조직에도 연결된 계정은 거부", () => {
    const member = [{ tenant_id: demoId("tenant"), role: "PCO_ADMIN" }];
    expect(() => assertDemoAccount("pco", { ...identity("pco"), app_metadata: {} }, member, [], [])).toThrow();
    expect(() => assertDemoAccount("pco", { ...identity("pco"), email: "real@example.com" }, member, [], [])).toThrow();
    expect(() => assertDemoAccount("pco", identity("pco"), [...member, { tenant_id: demoId("real-tenant"), role: "PCO_ADMIN" }], [], [])).toThrow();
    expect(() => assertDemoAccount("vendor", identity("vendor"), member, [{ vendor_id: demoId("vendor:FLIGHT") }], [])).toThrow();
    expect(() => assertDemoAccount("proxy", identity("proxy"), [], [], [])).toThrow();
  });

  it("대리인 데모는 베트남 하나만 허용하고 다른 국가 또는 복수 배정을 거부", () => {
    const vn = { delegation_id: demoId("delegation:VN") };
    const jp = { delegation_id: demoId("delegation:JP") };
    expect(() => assertDemoAccount("proxy", identity("proxy"), [], [], [vn])).not.toThrow();
    expect(() => assertDemoAccount("proxy", identity("proxy"), [], [], [jp])).toThrow();
    expect(() => assertDemoAccount("proxy", identity("proxy"), [], [], [vn, jp])).toThrow();
  });
});

describe("데모 입장", () => {
  it.each(DEMO_ROLES)("$label은 탭 역할만 정하고 지정된 화면으로 이동", async ({ role, path }) => {
    const form = new FormData();
    form.set("role", role);
    form.set("email", "untrusted@example.com");
    form.set("next", "https://untrusted.example.com");
    await expect(demoLogin(form)).resolves.toBe(path);
    expect(mocks.demoSessionCookies).toHaveBeenCalledWith(role);
    expect(mocks.setCookie).toHaveBeenCalledWith(DEMO_TAB_COOKIE, role, expect.objectContaining({ path: "/" }));
    expect(JSON.stringify(mocks.setCookie.mock.calls)).not.toContain("server-held");
  });

  it("알 수 없는 역할과 비활성화 상태는 세션 발급 전에 차단", async () => {
    const form = new FormData();
    form.set("role", "real-admin");
    await expect(demoLogin(form)).resolves.toContain("/login?error=");
    vi.stubEnv("DEMO_MODE", "false");
    form.set("role", "pco");
    await expect(demoLogin(form)).resolves.toBe("/login");
    expect(mocks.demoSessionCookies).not.toHaveBeenCalled();
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("세션 발급 실패 시 탭 역할을 정하지 않고 안내", async () => {
    mocks.demoSessionCookies.mockRejectedValue(new Error("private server error"));
    const form = new FormData();
    form.set("role", "pco");
    await expect(demoLogin(form)).resolves.toContain("/login?error=");
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("탭 역할 쿠키는 데모 모드의 알려진 역할만 인정", () => {
    expect(demoTabRole("vendor-lodging")).toBe("vendor-lodging");
    expect(demoTabRole("PCO_ADMIN")).toBeNull();
    expect(demoTabRole(undefined)).toBeNull();
    vi.stubEnv("DEMO_MODE", "false");
    expect(demoTabRole("pco")).toBeNull();
  });

  it.each([logInPco, signUpPco, logInVendor, requestPortalOtp, verifyPortalOtp])("일반 인증·가입은 데모 모드에서 중지", async (action) => {
    await expect(action(new FormData())).rejects.toThrow("redirect:/login");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it.each([logOutPco, vendorLogout, portalLogout])("데모 로그아웃은 공용 세션을 끊지 않고 첫 화면으로", async (action) => {
    await expect(action()).rejects.toThrow("redirect:/login");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("데모 기본값과 원래 로그인 복귀 스위치", () => {
    vi.stubEnv("DEMO_MODE", undefined);
    expect(isDemoMode()).toBe(true);
    vi.stubEnv("DEMO_MODE", "false");
    expect(isDemoMode()).toBe(false);
  });
});
