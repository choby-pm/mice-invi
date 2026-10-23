import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDemoAccount: vi.fn(), generateLink: vi.fn(), verifyOtp: vi.fn() }));
vi.mock("@/server/auth/demo-account", () => ({ getDemoAccount: mocks.getDemoAccount }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, { cookies }: { cookies: { setAll: (list: { name: string; value: string }[]) => void } }) => ({
    auth: { verifyOtp: async (args: unknown) => {
      const result = await mocks.verifyOtp(args);
      if (!result.error) cookies.setAll([{ name: "sb-test-auth-token", value: `session-${mocks.verifyOtp.mock.calls.length}` }]);
      return result;
    } },
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.getDemoAccount.mockResolvedValue({ email: "choby.pm+demo-pco@gmail.com", admin: { auth: { admin: { generateLink: mocks.generateLink } } } });
  mocks.generateLink.mockResolvedValue({ data: { properties: { hashed_token: "server-only-token" } }, error: null });
  mocks.verifyOtp.mockResolvedValue({ error: null });
});

it("역할별 세션을 한 번 발급해 재사용하고, 50분이 지나면 새로 발급", async () => {
  const { demoSessionCookies } = await import("@/server/auth/demo-session");
  const [a, b] = await Promise.all([demoSessionCookies("pco", 0), demoSessionCookies("pco", 0)]);
  expect(a).toEqual([{ name: "sb-test-auth-token", value: "session-1" }]);
  expect(b).toBe(a);
  expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
  expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "server-only-token", type: "magiclink" });
  await demoSessionCookies("vendor-lodging", 0);
  expect(mocks.getDemoAccount).toHaveBeenLastCalledWith("vendor-lodging");
  expect(await demoSessionCookies("pco", 49 * 60 * 1000)).toBe(a);
  expect(await demoSessionCookies("pco", 51 * 60 * 1000)).toEqual([{ name: "sb-test-auth-token", value: "session-3" }]);
});

it("발급 실패는 보관하지 않고 다음 요청에서 다시 시도", async () => {
  const { demoSessionCookies } = await import("@/server/auth/demo-session");
  mocks.verifyOtp.mockResolvedValueOnce({ error: new Error("session failure") });
  await expect(demoSessionCookies("pco", 0)).rejects.toThrow("session failure");
  await expect(demoSessionCookies("pco", 0)).resolves.toHaveLength(1);
  mocks.getDemoAccount.mockRejectedValueOnce(new Error("not a demo account"));
  await expect(demoSessionCookies("field", 0)).rejects.toThrow("not a demo account");
  expect(mocks.generateLink).toHaveBeenCalledTimes(2);
});
