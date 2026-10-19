import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ServiceCell, type MatrixServiceItem } from "@/components/console/delegation-matrix";
import { SERVICE_TYPES } from "@/lib/service-item-constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TYPE_LABEL: Record<string, string> = { VIP: "VIP", COMPANION: "동반자", STAFF: "수행원" };

export default async function RosterPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ id }, { q = "" }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data, error } = await supabase.from("delegation")
    .select("id, name, country, participant(id, first_name, last_name, participant_type, title, nationality, status, sort_order), service_item(id, service_type, status, room_assignment(hotel_name, room_type, participant_ids), vehicle_dispatch(participant_ids), transfer_request(direction, participant_ids))")
    .eq("event_id", id).order("name");
  if (error) throw error;
  const rows = (data ?? []).flatMap((d) => d.participant
    .toSorted((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({ ...p, delegation: d }))
  ).filter((p) => `${p.last_name} ${p.first_name} ${p.delegation.name} ${p.nationality}`.toLowerCase().includes(q.trim().toLowerCase()));

  return <div className="space-y-4">
    <h1 className="text-lg font-semibold">전체 명단</h1>
    <form className="flex max-w-lg gap-2">
      <Input name="q" defaultValue={q} aria-label="이름·대표단·국적 검색" placeholder="이름·대표단·국적 검색" />
      <Button type="submit" variant="outline">검색</Button>
    </form>
    <p className="text-sm text-muted-foreground">검색 결과 {rows.length}명 · 대표단 이름을 누르면 상세 화면으로 이동합니다.</p>
    <div className="max-h-[70vh] overflow-auto rounded-md border [&_[data-slot=table-container]]:overflow-visible">
      <Table>
        <TableHeader className="sticky top-0 z-20 bg-background"><TableRow>
          <TableHead className="sticky left-0 z-30 min-w-40 bg-background">참가자</TableHead>
          <TableHead className="min-w-40">대표단</TableHead><TableHead>유형</TableHead><TableHead>직함</TableHead><TableHead>국적</TableHead>
          {SERVICE_TYPES.map((t) => <TableHead key={t.value} className="min-w-32">{t.label}</TableHead>)}
        </TableRow></TableHeader>
        <TableBody>{rows.map((p) => <TableRow key={p.id}>
          <TableCell className="sticky left-0 z-10 bg-background font-medium">{p.last_name} {p.first_name}</TableCell>
          <TableCell><Link className="underline" href={`/console/events/${id}/delegations/${p.delegation.id}`}>{p.delegation.name}</Link></TableCell>
          <TableCell>{TYPE_LABEL[p.participant_type] ?? p.participant_type}</TableCell><TableCell>{p.title || "—"}</TableCell><TableCell>{p.nationality}</TableCell>
          {SERVICE_TYPES.map((t) => <TableCell key={t.value}><ServiceCell participantId={p.id} items={p.delegation.service_item.filter((s) => s.service_type === t.value) as MatrixServiceItem[]} /></TableCell>)}
        </TableRow>)}</TableBody>
      </Table>
      {rows.length === 0 && <p className="p-6 text-sm text-muted-foreground">조건에 맞는 참가자가 없습니다.</p>}
    </div>
  </div>;
}
