import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/server/modules/org/get-membership";
import { saveProtocolLevel, saveSupportPolicy } from "@/server/modules/event/settings-actions";
import { SERVICE_TYPES, SUPPORT_TYPE_LABEL } from "@/lib/service-item-constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PARTICIPANTS: Record<string, string> = { VIP: "VIP", COMPANION: "동반자", STAFF: "수행원", ALL: "전체 참가자" };
const selectClass = "w-full rounded-md border bg-background px-3 py-2 text-sm";

function PolicyForm({ eventId, policy, disabled }: { eventId: string; disabled: boolean; policy?: {
  id: string; service_type: string; participant_type: string; support_type: string; max_count: number | null;
  overflow_support_type: string | null; guide_text: { ko?: string; en?: string };
} }) {
  return <form action={saveSupportPolicy}>
    <input type="hidden" name="eventId" value={eventId} />
    <input type="hidden" name="id" value={policy?.id ?? ""} />
    <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm">서비스<select name="serviceType" defaultValue={policy?.service_type} className={selectClass}>{SERVICE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
      <label className="space-y-1 text-sm">참가자 유형<select name="participantType" defaultValue={policy?.participant_type} className={selectClass}>{Object.entries(PARTICIPANTS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
      <label className="space-y-1 text-sm">지원 방식<select name="supportType" defaultValue={policy?.support_type} className={selectClass}>{Object.entries(SUPPORT_TYPE_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
      <label className="space-y-1 text-sm">대표단별 인원 한도 (빈칸: 제한 없음)<Input type="number" name="maxCount" min="0" step="1" defaultValue={policy?.max_count ?? ""} /></label>
      <label className="space-y-1 text-sm">한도 초과 시 지원<select name="overflowSupportType" defaultValue={policy?.overflow_support_type ?? ""} className={selectClass}><option value="">미지정</option>{Object.entries(SUPPORT_TYPE_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
      <label className="space-y-1 text-sm">한국어 안내<Textarea name="guideKo" maxLength={5000} defaultValue={policy?.guide_text?.ko ?? ""} /></label>
      <label className="space-y-1 text-sm">영어 안내<Textarea name="guideEn" maxLength={5000} defaultValue={policy?.guide_text?.en ?? ""} /></label>
      {!disabled && <div className="self-end"><Button type="submit">{policy ? "정책 저장" : "정책 추가"}</Button></div>}
    </fieldset>
  </form>;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ eventId?: string; error?: string; saved?: string }> }) {
  const query = await searchParams;
  const membership = await getCurrentMembership();
  if (!membership) redirect("/console-login");
  const supabase = await createClient();
  const events = await supabase.from("event").select("id, name").eq("tenant_id", membership.tenantId).order("created_at", { ascending: false });
  if (events.error) throw events.error;
  const event = query.eventId ? events.data?.find((e) => e.id === query.eventId) : events.data?.[0];
  if (query.eventId && !event) notFound();
  if (!event) return <div className="space-y-3"><h1 className="text-lg font-semibold">행사 설정</h1><p>먼저 행사를 등록해 주세요.</p><Link href="/console" className="underline">행사 목록</Link></div>;
  const [levels, policies] = await Promise.all([
    supabase.from("protocol_level").select("id, name, sort_order").eq("event_id", event.id).order("sort_order"),
    supabase.from("support_policy").select("id, service_type, participant_type, support_type, max_count, overflow_support_type, guide_text").eq("event_id", event.id).order("service_type"),
  ]);
  if (levels.error) throw levels.error;
  if (policies.error) throw policies.error;
  const readOnly = membership.role === "PCO_FIELD";
  return <div className="max-w-5xl space-y-4">
    <h1 className="text-lg font-semibold">행사 설정</h1>
    <form className="flex gap-2"><select name="eventId" aria-label="행사 선택" defaultValue={event.id} className={selectClass}>{events.data?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select><Button variant="outline">선택</Button></form>
    {readOnly && <p className="text-sm text-muted-foreground">현장 직원은 설정을 조회할 수 있습니다. 수정은 관리자·담당자가 진행합니다.</p>}
    {query.error && <p role="alert" className="text-sm text-status-urgent-fg">{query.error}</p>}
    {query.saved && <p role="status" className="text-sm text-status-done-fg">저장했습니다.</p>}
    <nav className="flex flex-wrap gap-4 text-sm underline">{[["vendors", "담당 업체"], ["consent", "동의서·안내문"], ["programs", "하위 행사"]].map(([path, label]) => <Link key={path} href={`/console/events/${event.id}/${path}`}>{label}</Link>)}</nav>
    <Card><CardHeader><CardTitle>의전 등급 ({levels.data?.length ?? 0})</CardTitle></CardHeader><CardContent className="space-y-3">
      {levels.data?.map((level) => <form key={level.id} action={saveProtocolLevel}>
        <input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="id" value={level.id} />
        <fieldset disabled={readOnly} className="flex flex-wrap items-end gap-2">
          <label className="text-sm">등급 이름<Input name="name" defaultValue={level.name} maxLength={100} required /></label>
          <label className="text-sm">정렬 순서<Input name="sortOrder" type="number" min="0" step="1" defaultValue={level.sort_order} required className="w-28" /></label>
          {!readOnly && <Button variant="outline">등급 저장</Button>}
        </fieldset>
      </form>)}
      {!readOnly && <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm">의전 등급 추가</summary><form action={saveProtocolLevel} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="eventId" value={event.id} /><label className="text-sm">등급 이름<Input name="name" maxLength={100} required /></label><label className="text-sm">정렬 순서<Input name="sortOrder" type="number" min="0" step="1" defaultValue={levels.data?.length ?? 0} required className="w-28" /></label><Button>등급 추가</Button>
      </form></details>}
    </CardContent></Card>
    <h2 className="font-medium">지원 정책 ({policies.data?.length ?? 0})</h2>
    <p className="text-sm text-muted-foreground">정책 기준과 안내문을 관리합니다. 변경해도 이미 등록된 서비스의 지원 방식·예약 결과는 자동 변경되지 않습니다.</p>
    {policies.data?.map((policy) => <Card key={policy.id}><CardContent className="py-4"><PolicyForm eventId={event.id} policy={policy} disabled={readOnly} /></CardContent></Card>)}
    {!readOnly && <details className="rounded-md border p-4"><summary className="cursor-pointer text-sm">지원 정책 추가</summary><div className="mt-3"><PolicyForm eventId={event.id} disabled={false} /></div></details>}
  </div>;
}
