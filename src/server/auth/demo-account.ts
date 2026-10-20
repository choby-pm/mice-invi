import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DemoRole } from "@/lib/demo";
import { demoId, SERVICE_TYPES } from "../../../scripts/demo-data.mjs";

const PCO_ROLES = { pco: "PCO_ADMIN", manager: "PCO_MANAGER", field: "PCO_FIELD" } as const;
const tenantId = demoId("tenant");
const vendorIds = SERVICE_TYPES.map((type) => demoId(`vendor:${type}`));
const delegationIds = [demoId("delegation:VN")];

export async function getDemoAccount(role: DemoRole) {
  const admin = createAdminClient();
  let query;
  if (role === "vendor") query = admin.from("vendor_member").select("user_id").eq("vendor_id", vendorIds[0]).eq("role", "ADMIN");
  else if (role === "proxy") query = admin.from("delegation_proxy").select("user_id").eq("delegation_id", delegationIds[0]).eq("status", "ACTIVE");
  else query = admin.from("tenant_member").select("user_id").eq("tenant_id", tenantId).eq("role", PCO_ROLES[role]);
  const { data: member, error } = await query.single();
  if (error || !member) throw new Error("데모 계정이 준비되지 않았습니다. 데모 데이터 생성을 먼저 완료해 주세요.");
  const [account, ...scopes] = await Promise.all([
    admin.auth.admin.getUserById(member.user_id),
    admin.from("tenant_member").select("tenant_id, role").eq("user_id", member.user_id),
    admin.from("vendor_member").select("vendor_id").eq("user_id", member.user_id),
    admin.from("delegation_proxy").select("delegation_id").eq("user_id", member.user_id).eq("status", "ACTIVE"),
  ]);
  if (account.error || !account.data.user) throw new Error("데모 계정을 확인할 수 없습니다.");
  const user = account.data.user;
  if (scopes.some((scope) => scope.error)) throw new Error("데모 계정의 접근 범위를 확인할 수 없습니다.");
  assertDemoAccount(role, user, scopes[0].data ?? [], scopes[1].data ?? [], scopes[2].data ?? []);
  return { admin, email: user.email! };
}

export function assertDemoAccount(
  role: DemoRole,
  user: Pick<User, "email" | "app_metadata">,
  tenants: { tenant_id: string; role: string }[],
  vendors: { vendor_id: string }[],
  delegations: { delegation_id: string }[],
) {
  const validIdentity = user.email === `choby.pm+demo-${role}@gmail.com` && user.app_metadata.demo_seed === "mice-invi-v1";
  const validScope = role === "vendor"
    ? !tenants.length && !delegations.length && vendors.length > 0 && vendors.every((v) => vendorIds.includes(v.vendor_id))
    : role === "proxy"
      ? !tenants.length && !vendors.length && delegations.length === 1 && delegations[0].delegation_id === delegationIds[0]
      : !vendors.length && !delegations.length && tenants.length === 1 && tenants[0].tenant_id === tenantId && tenants[0].role === PCO_ROLES[role];
  if (!validIdentity || !validScope) throw new Error("데모 전용 계정만 사용할 수 있습니다.");
}
