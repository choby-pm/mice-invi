// 권한·테넌트 격리 자동 테스트 (04 §2.4, 08 §5.3 위험 영역 1번).
// "다른 PCO의 행사 데이터가 보이면 안 된다"를 실제 Supabase(Postgres RLS)에 대고 검증합니다.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { bootstrapTenant } from "@/server/modules/org/bootstrap-tenant";

const admin = createAdminClient();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

function randomEmail(tag: string) {
  return `r1-test-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function createSignedInUser(tag: string) {
  const email = randomEmail(tag);
  const password = "Test-password-123!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;

  const client = createSupabaseClient(url, publishableKey);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { userId: data.user.id, client };
}

describe("테넌트 격리 (RLS)", () => {
  let tenantA: { id: string }, tenantB: { id: string };
  let userA: Awaited<ReturnType<typeof createSignedInUser>>;
  let userB: Awaited<ReturnType<typeof createSignedInUser>>;
  let eventAId: string;

  beforeAll(async () => {
    userA = await createSignedInUser("a");
    userB = await createSignedInUser("b");
    tenantA = await bootstrapTenant("테스트 PCO A", userA.userId);
    tenantB = await bootstrapTenant("테스트 PCO B", userB.userId);

    const { data, error } = await userA.client
      .from("event")
      .insert({ tenant_id: tenantA.id, name: "A 테넌트 행사" })
      .select()
      .single();
    if (error) throw error;
    eventAId = data.id;
  });

  afterAll(async () => {
    // beforeAll이 중간에 실패해도(예: 스키마 미적용) 만들어진 부분까지는 정리합니다.
    // event를 먼저 지우는 이유: 테넌트 삭제에 딸려 연쇄 삭제되면 감사 로그 트리거가
    // 막 지워지는 테넌트를 참조하려다 실패할 수 있어서입니다 (0003 마이그레이션에서 고침).
    if (tenantA?.id) await admin.from("event").delete().eq("tenant_id", tenantA.id);
    if (tenantB?.id) await admin.from("event").delete().eq("tenant_id", tenantB.id);
    if (tenantA?.id) await admin.from("tenant").delete().eq("id", tenantA.id);
    if (tenantB?.id) await admin.from("tenant").delete().eq("id", tenantB.id);
    if (userA?.userId) await admin.auth.admin.deleteUser(userA.userId);
    if (userB?.userId) await admin.auth.admin.deleteUser(userB.userId);
  });

  it("같은 테넌트 멤버는 자기 행사를 볼 수 있다", async () => {
    const { data, error } = await userA.client.from("event").select("id").eq("id", eventAId);
    expect(error).toBeNull();
    expect(data?.map((r) => r.id)).toContain(eventAId);
  });

  it("다른 테넌트 멤버에게는 보이지 않는다 (404와 동등 — 존재 비노출)", async () => {
    const { data, error } = await userB.client.from("event").select("id").eq("id", eventAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("다른 테넌트 멤버는 남의 테넌트에 행사를 만들 수 없다", async () => {
    const { error } = await userB.client
      .from("event")
      .insert({ tenant_id: tenantA.id, name: "B가 몰래 넣으려는 행사" });
    expect(error).not.toBeNull();
  });

  it("PCO_FIELD(조회 전용)는 행사를 만들 수 없다", async () => {
    const field = await createSignedInUser("field");
    await admin.from("tenant_member").insert({
      tenant_id: tenantA.id,
      user_id: field.userId,
      role: "PCO_FIELD",
    });

    const { error } = await field.client
      .from("event")
      .insert({ tenant_id: tenantA.id, name: "현장 스태프가 만들면 안 되는 행사" });
    expect(error).not.toBeNull();

    await admin.auth.admin.deleteUser(field.userId);
  });
});
