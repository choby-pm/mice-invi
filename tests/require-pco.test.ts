import { beforeEach, expect, it, vi } from "vitest";
import { requirePcoMembership } from "@/server/modules/org/get-membership";

const state = vi.hoisted(() => ({ user: null as { id: string } | null, rows: {} as Record<string, unknown[]> }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => {
      const data = state.rows[table] ?? [];
      const query = {
        select: () => query, eq: () => query, limit: () => query,
        maybeSingle: async () => ({ data: data[0] ?? null }),
        then: (resolve: (value: { data: unknown[] }) => void) => Promise.resolve({ data }).then(resolve),
      };
      return query;
    },
  }),
}));

beforeEach(() => { state.user = { id: "u1" }; state.rows = {}; });

it("PCO 소속은 그대로 콘솔 사용", async () => {
  state.rows.tenant_member = [{ tenant_id: "t1", role: "PCO_ADMIN", tenant: { name: "데모" } }];
  await expect(requirePcoMembership()).resolves.toMatchObject({ tenantId: "t1", role: "PCO_ADMIN" });
});

it("업체·대리인은 자기 화면으로, 로그인 전·소속 없음은 로그인 화면으로", async () => {
  state.rows.vendor_member = [{ vendor_id: "v1" }];
  await expect(requirePcoMembership()).rejects.toThrow("redirect:/vendor");
  state.rows = { delegation_proxy: [{ delegation_id: "d1" }] };
  await expect(requirePcoMembership()).rejects.toThrow("redirect:/portal");
  state.rows = {};
  await expect(requirePcoMembership()).rejects.toThrow("redirect:/console-login");
  state.user = null;
  await expect(requirePcoMembership()).rejects.toThrow("redirect:/console-login");
});
