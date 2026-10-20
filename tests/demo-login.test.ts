import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoId } from "../scripts/demo-data.mjs";
import { assertDemoAccount } from "@/server/auth/demo-account";
import { demoLogin } from "@/server/auth/demo-login";
import { DEMO_ROLES, isDemoMode, type DemoRole } from "@/lib/demo";
import { logInPco, signUpPco } from "@/server/modules/iam/auth-actions";
import { logInVendor } from "@/server/modules/iam/vendor-auth-actions";
import { requestPortalOtp, verifyPortalOtp } from "@/server/modules/iam/portal-auth-actions";

const mocks = vi.hoisted(() => ({
  getDemoAccount: vi.fn(),
  generateLink: vi.fn(),
  verifyOtp: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/server/auth/demo-account", async (original) => ({
  ...await original<typeof import("@/server/auth/demo-account")>(),
  getDemoAccount: mocks.getDemoAccount,
}));

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "true");
  vi.clearAllMocks();
  mocks.getDemoAccount.mockResolvedValue({ email: "choby.pm+demo-pco@gmail.com", admin: { auth: { admin: { generateLink: mocks.generateLink } } } });
  mocks.generateLink.mockResolvedValue({ data: { properties: { hashed_token: "server-only-test-token" } }, error: null });
  mocks.verifyOtp.mockResolvedValue({ error: null });
  mocks.createClient.mockResolvedValue({ auth: { verifyOtp: mocks.verifyOtp } });
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

describe("데모 로그인", () => {
  it.each(DEMO_ROLES)("$label은 지정된 화면으로 이동", async ({ role, path }) => {
    const form = new FormData();
    form.set("role", role);
    form.set("email", "untrusted@example.com");
    form.set("next", "https://untrusted.example.com");
    await expect(demoLogin(form)).rejects.toThrow(`redirect:${path}`);
    expect(mocks.getDemoAccount).toHaveBeenCalledWith(role);
    expect(mocks.generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "choby.pm+demo-pco@gmail.com" });
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "server-only-test-token", type: "magiclink" });
  });

  it("알 수 없는 역할과 비활성화 상태는 인증 전에 차단", async () => {
    const form = new FormData();
    form.set("role", "real-admin");
    await expect(demoLogin(form)).rejects.toThrow("redirect:/login?error=");
    vi.stubEnv("DEMO_MODE", "false");
    form.set("role", "pco");
    await expect(demoLogin(form)).rejects.toThrow("redirect:/login");
    expect(mocks.getDemoAccount).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("계정 검증·DB 연결 실패는 인증하지 않고 안내", async () => {
    mocks.getDemoAccount.mockRejectedValue(new Error("private server error"));
    const form = new FormData();
    form.set("role", "pco");
    await expect(demoLogin(form)).rejects.toThrow("redirect:/login?error=");
    expect(mocks.generateLink).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("토큰 생성 또는 세션 검증 실패 시 화면 입장 거부", async () => {
    const form = new FormData();
    form.set("role", "pco");
    mocks.generateLink.mockResolvedValueOnce({ data: null, error: new Error("token failure") });
    await expect(demoLogin(form)).rejects.toThrow("redirect:/login?error=");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    mocks.verifyOtp.mockResolvedValueOnce({ error: new Error("session failure") });
    await expect(demoLogin(form)).rejects.toThrow("redirect:/login?error=");
  });

  it.each([logInPco, signUpPco, logInVendor, requestPortalOtp, verifyPortalOtp])("일반 인증·가입은 데모 모드에서 중지", async (action) => {
    await expect(action(new FormData())).rejects.toThrow("redirect:/login");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("데모 기본값과 원래 로그인 복귀 스위치", () => {
    vi.stubEnv("DEMO_MODE", undefined);
    expect(isDemoMode()).toBe(true);
    vi.stubEnv("DEMO_MODE", "false");
    expect(isDemoMode()).toBe(false);
  });
});
