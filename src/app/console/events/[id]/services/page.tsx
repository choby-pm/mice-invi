import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { ServiceBoard } from "@/components/console/service-board";

export default async function ServicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: items }, { data: delegations }, { data: eventVendors }] = await Promise.all([
    supabase
      .from("service_item")
      .select("id, service_type, status, support_type, scheduled_at, delegation:delegation_id(id, name), event_vendor:event_vendor_id(id, vendor:vendor_id(name))")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
    supabase.from("delegation").select("id, name").eq("event_id", eventId).order("name"),
    supabase.from("event_vendor").select("id, service_types, vendor:vendor_id(name)").eq("event_id", eventId),
  ]);

  return (
    <ServiceBoard
      eventId={eventId}
      items={(items ?? []) as never}
      delegations={delegations ?? []}
      eventVendors={(eventVendors ?? []) as never}
    />
  );
}
