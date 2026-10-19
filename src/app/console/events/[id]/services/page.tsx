import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { ServiceBoard } from "@/components/console/service-board";
import { SERVICE_DETAILS_SELECT } from "@/lib/service-detail-query";

export default async function ServicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: items }, { data: delegations }, { data: eventVendors }] = await Promise.all([
    supabase
      .from("service_item")
      .select(`${SERVICE_DETAILS_SELECT}, event_vendor:event_vendor_id(id, vendor:vendor_id(name))`)
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
