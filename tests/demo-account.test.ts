import { beforeEach, expect, it, vi } from "vitest";
import { getDemoAccount } from "@/server/auth/demo-account";
import { demoId } from "../scripts/demo-data.mjs";

const mocks = vi.hoisted(() => ({ from: vi.fn(), getUserById: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from: mocks.from,
  auth: { admin: { getUserById: mocks.getUserById } },
}) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserById.mockResolvedValue({ data: { user: {
    id: "demo-user", email: "choby.pm+demo-pco@gmail.com", app_metadata: { demo_seed: "mice-invi-v1" },
  } }, error: null });
  mocks.from.mockImplementation((table: string) => {
    const result = { data: table === "tenant_member" ? [{ tenant_id: demoId("tenant"), role: "PCO_ADMIN" }] : [], error: null };
    const query = {
      select: () => query,
      eq: () => query,
      single: async () => ({ data: { user_id: "demo-user" }, error: null }),
      then: (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve),
    };
    return query;
  });
});

it("사용자 조회가 끝나기 전에 세 접근 범위를 함께 검사", async () => {
  let finishUser!: (value: unknown) => void;
  const user = await mocks.getUserById();
  mocks.getUserById.mockReturnValue(new Promise((resolve) => { finishUser = resolve; }));
  const account = getDemoAccount("pco");
  await vi.waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(4));
  finishUser(user);
  expect(await account).toMatchObject({ email: "choby.pm+demo-pco@gmail.com" });
});

it("병렬 조회 중 계정 검증이 실패하면 입장 거부", async () => {
  mocks.getUserById.mockResolvedValue({ data: { user: null }, error: new Error("lookup failed") });
  await expect(getDemoAccount("pco")).rejects.toThrow("데모 계정을 확인할 수 없습니다");
});
