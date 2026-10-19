import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { demoId } from "../../../scripts/demo-data.mjs";

export async function getVendorContext() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/vendor-login");
  const { data, error } = await supabase.from("vendor_member")
    .select("role, vendor:vendor_id(id, name)").eq("user_id", user.id);
  if (error) throw error;
  const flightDemo = user.email === "choby.pm+demo-vendor@gmail.com" && user.app_metadata.demo_seed === "mice-invi-v1";
  const memberships = (data ?? []).flatMap((m) => {
    const vendor = m.vendor as unknown as { id: string; name: string } | null;
    return vendor && (!flightDemo || vendor.id === demoId("vendor:FLIGHT")) ? [{ role: m.role, vendor }] : [];
  });
  // 배정표(event_vendor)는 PCO 전용입니다. 업체가 RLS로 볼 수 있는 서비스에서 담당 범위를 구합니다.
  let query = supabase.from("service_item").select("event_vendor_id, service_type, event:event_id(id, name, status)");
  if (flightDemo) query = query.eq("service_type", "FLIGHT");
  const services = memberships.length ? await query.order("event_vendor_id") : { data: [], error: null };
  if (services.error) throw services.error;
  const byAssignment = new Map<string, { id: string; service_types: string[]; event: { id: string; name: string; status: string } | null }>();
  for (const service of services.data ?? []) {
    if (!service.event_vendor_id) continue;
    let assignment = byAssignment.get(service.event_vendor_id);
    if (!assignment) {
      assignment = { id: service.event_vendor_id, service_types: [], event: service.event as unknown as { id: string; name: string; status: string } | null };
      byAssignment.set(assignment.id, assignment);
    }
    if (!assignment.service_types.includes(service.service_type)) assignment.service_types.push(service.service_type);
  }
  return { supabase, user, memberships, assignments: [...byAssignment.values()], flightDemo };
}
