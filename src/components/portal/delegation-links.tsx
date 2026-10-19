import Link from "next/link";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { BlankScreen } from "@/components/shared/blank-screen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMessages } from "@/i18n/get-messages";

export async function DelegationLinks({ section }: { section?: "flight" | "schedule" }) {
  const { messages } = await getMessages();
  const supabase = await createServerSupabaseClient();
  const { data: assignments, error } = await supabase
    .from("delegation_proxy")
    .select("delegation:delegation_id(id, name, organization, event:event_id(name))")
    .eq("status", "ACTIVE");

  if (error) throw error;

  if (!assignments || assignments.length === 0) {
    return <BlankScreen title={messages.portal.noDelegations} note={messages.portal.assignmentHint} />;
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">{messages.nav[section ?? "checklist"]}</h1>
      {section && <p className="text-sm text-muted-foreground">{messages.portal.selectDelegation}</p>}
      {assignments.map((a, i) => {
        const delegation = a.delegation as unknown as {
          id: string;
          name: string;
          organization: string;
          event: { name: string } | null;
        };
        if (!delegation) return null;
        return (
          <Link key={i} href={`/portal/delegation/${delegation.id}${section ? `#${section}` : ""}`}>
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
