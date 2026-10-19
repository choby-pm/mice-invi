import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMessages } from "@/i18n/get-messages";
import { formatDateTime } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PortalMessagesPage() {
  const { locale, messages } = await getMessages();
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/portal-login");
  const assignments = await supabase.from("delegation_proxy")
    .select("delegation:delegation_id(id, name, event_id, event:event_id(name))")
    .eq("user_id", user.id).eq("status", "ACTIVE");
  if (assignments.error) throw assignments.error;
  const delegations = (assignments.data ?? []).flatMap((a) => {
    const d = a.delegation as unknown as { id: string; name: string; event_id: string; event: { name: string } | null } | null;
    return d ? [d] : [];
  });
  const eventIds = [...new Set(delegations.map((d) => d.event_id))];
  const results = eventIds.length ? await Promise.all([
    supabase.from("consent_policy").select("id, event_id, notice_body, published_at")
      .in("event_id", eventIds).eq("is_current", true).not("published_at", "is", null).order("published_at", { ascending: false }),
    supabase.from("program").select("id, name, organizer_delegation_id, pco_adjust_note, start_at")
      .in("organizer_delegation_id", delegations.map((d) => d.id)).not("pco_adjust_note", "is", null).order("start_at", { ascending: true }),
  ]) : [];
  for (const result of results) if (result.error) throw result.error;
  const notices = (results[0]?.data ?? []).flatMap((n) => {
    const body = n.notice_body as { ko?: string; en?: string } | null;
    const content = body?.[locale] || body?.en || body?.ko;
    const delegation = delegations.find((d) => d.event_id === n.event_id);
    return content && delegation ? [{ ...n, content, delegation }] : [];
  });
  const adjustments = results[1]?.data ?? [];
  return <div className="max-w-3xl space-y-4">
    <h1 className="text-lg font-semibold">{messages.inbox.title}</h1>
    <p className="text-sm text-muted-foreground">{messages.inbox.description}</p>
    {adjustments.map((p) => <Card key={p.id}>
      <CardHeader><CardTitle className="text-base">{messages.inbox.adjustment} · {p.name}</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="whitespace-pre-wrap">{p.pco_adjust_note}</p>
        {p.start_at && <p className="text-muted-foreground">{messages.inbox.scheduleTime}: {formatDateTime(p.start_at, locale)}</p>}
        <Link href={`/portal/delegation/${p.organizer_delegation_id}#schedule`} className="underline">{messages.inbox.open}</Link>
      </CardContent>
    </Card>)}
    {notices.map((n) => <Card key={n.id}>
      <CardHeader><CardTitle className="text-base">{messages.inbox.notice} · {n.delegation.event?.name}</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="whitespace-pre-wrap">{n.content}</p>
        <p className="text-muted-foreground">{formatDateTime(n.published_at, locale)}</p>
        <Link href={`/portal/delegation/${n.delegation.id}`} className="underline">{messages.inbox.open}</Link>
      </CardContent>
    </Card>)}
    {notices.length === 0 && adjustments.length === 0 && <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">{messages.inbox.empty}</p>}
  </div>;
}
