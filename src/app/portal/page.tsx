import Link from "next/link";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { BlankScreen } from "@/components/shared/blank-screen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMessages } from "@/i18n/get-messages";

export default async function PortalHomePage() {
  const { messages } = await getMessages();
  const supabase = await createServerSupabaseClient();
  const { data: assignments } = await supabase
    .from("delegation_proxy")
    .select("delegation:delegation_id(id, name, organization, event:event_id(name))")
    .eq("status", "ACTIVE");

  if (!assignments || assignments.length === 0) {
    return <BlankScreen title="배정된 대표단이 없습니다" note="PCO가 대표단에 초청하면 여기에 표시됩니다." />;
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">{messages.nav.checklist}</h1>
      {assignments.map((a, i) => {
        const delegation = a.delegation as unknown as {
          id: string;
          name: string;
          organization: string;
          event: { name: string } | null;
        };
        return (
          <Link key={i} href={`/portal/delegation/${delegation.id}`}>
            <Card className="hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">{delegation.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {delegation.event?.name} · {delegation.organization}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
