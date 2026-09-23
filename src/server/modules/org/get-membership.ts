import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export interface Membership {
  userId: string;
  tenantId: string;
  tenantName: string;
  role: "PCO_ADMIN" | "PCO_MANAGER" | "PCO_FIELD";
}

// 로그인한 사용자의 소속 테넌트·역할. R1에서는 한 사용자가 한 테넌트에만 속한다고 가정합니다.
export async function getCurrentMembership(): Promise<Membership | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("tenant_member")
    .select("tenant_id, role, tenant:tenant_id(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  const tenant = data.tenant as unknown as { name: string } | null;
  return {
    userId: user.id,
    tenantId: data.tenant_id,
    tenantName: tenant?.name ?? "",
    role: data.role as Membership["role"],
  };
}
