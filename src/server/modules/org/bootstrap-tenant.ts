import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 새 PCO가 처음 가입할 때 테넌트 + 첫 관리자 멤버를 만듭니다.
 * tenant_member의 첫 행은 RLS 검사(current_tenant_role)를 통과할 수 없으므로
 * (아직 역할이 없어 통과 불가능) 관리자 키로 우회해서 만드는 유일하게 정당한 경로입니다.
 */
export async function bootstrapTenant(tenantName: string, userId: string) {
  const admin = createAdminClient();

  const { data: tenant, error: tenantError } = await admin
    .from("tenant")
    .insert({ name: tenantName })
    .select()
    .single();
  if (tenantError) throw tenantError;

  const { error: memberError } = await admin
    .from("tenant_member")
    .insert({ tenant_id: tenant.id, user_id: userId, role: "PCO_ADMIN" });
  if (memberError) throw memberError;

  await admin.from("audit_log").insert({
    tenant_id: tenant.id,
    actor_user_id: userId,
    action: "tenant.created",
    entity_type: "tenant",
    entity_id: tenant.id,
  });

  return tenant as { id: string; name: string };
}
