import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { VendorBoard } from "@/components/console/vendor-board";
import { getCurrentMembership } from "@/server/modules/org/get-membership";

export default async function EventVendorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const membership = await getCurrentMembership();
  const supabase = await createServerSupabaseClient();
  const [{ data: eventVendors }, { data: items }] = await Promise.all([
    supabase
      .from("event_vendor")
      .select("id, service_types, settled_at, vendor:vendor_id(id, name)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true }),
    supabase.from("service_item").select("event_vendor_id, status").eq("event_id", eventId),
  ]);

  const countByVendor: Record<string, number> = {};
  for (const item of items ?? []) {
    if (!item.event_vendor_id) continue;
    countByVendor[item.event_vendor_id] = (countByVendor[item.event_vendor_id] ?? 0) + 1;
  }

  return (
    <VendorBoard
      eventId={eventId}
      eventVendors={(eventVendors ?? []) as unknown as {
        id: string;
        service_types: string[];
        settled_at: string | null;
        vendor: { id: string; name: string } | null;
      }[]}
      taskCountByVendor={countByVendor}
      readOnly={!membership || membership.role === "PCO_FIELD"}
    />
  );
}
