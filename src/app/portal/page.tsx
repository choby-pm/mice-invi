import { DelegationLinks } from "@/components/portal/delegation-links";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PortalHomePage() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/portal-login");
  const { data, error } = await client.from("delegation_proxy").select("delegation_id").eq("user_id", user.id).eq("status", "ACTIVE");
  if (error) throw error;
  if (data?.length === 1) redirect(`/portal/delegation/${data[0].delegation_id}`);
  return <DelegationLinks />;
}
