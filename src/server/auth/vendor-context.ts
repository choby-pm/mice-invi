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
  const vendorIds = memberships.map((m) => m.vendor.id);
  const assignments = vendorIds.length ? await supabase.from("event_vendor")
    .select("id, vendor_id, service_types, event:event_id(id, name, status)").in("vendor_id", vendorIds) : { data: [], error: null };
  if (assignments.error) throw assignments.error;
  return { supabase, user, memberships, assignments: assignments.data ?? [], flightDemo };
}
