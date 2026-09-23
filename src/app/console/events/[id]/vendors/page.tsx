import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { VendorBoard } from "@/components/console/vendor-board";

export default async function EventVendorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: eventVendors } = await supabase
    .from("event_vendor")
    .select("id, service_types, vendor:vendor_id(id, name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  return (
    <VendorBoard
      eventId={eventId}
      eventVendors={(eventVendors ?? []) as unknown as {
        id: string;
        service_types: string[];
        vendor: { id: string; name: string } | null;
      }[]}
    />
  );
}
