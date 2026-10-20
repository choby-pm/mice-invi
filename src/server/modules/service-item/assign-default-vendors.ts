import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SERVICE_TYPES } from "@/lib/service-item-constants";

export async function assignDefaultServiceVendors(client: SupabaseClient, eventId: string) {
  const vendors = await client.from("event_vendor").select("id, service_types").eq("event_id", eventId).eq("delegation_scope", "ALL");
  if (vendors.error) throw vendors.error;
  for (const type of SERVICE_TYPES) {
    const candidates = (vendors.data ?? []).filter((v) => v.service_types.includes(type.value));
    if (candidates.length !== 1) continue;
    const result = await client.from("service_item").update({ event_vendor_id: candidates[0].id })
      .eq("event_id", eventId).eq("service_type", type.value).is("event_vendor_id", null).in("status", ["DRAFT", "REQUESTED"]);
    if (result.error) throw result.error;
  }
}
