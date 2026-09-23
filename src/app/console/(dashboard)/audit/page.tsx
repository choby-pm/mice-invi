import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/date";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BlankScreen } from "@/components/shared/blank-screen";

const ACTION_LABEL: Record<string, string> = {
  "tenant.created": "회사 계정 생성",
  "event.created": "행사 생성",
  "event.updated": "행사 수정",
  "event.deleted": "행사 삭제",
};

export default async function AuditLogPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: rows } = await supabase
    .from("audit_log")
    .select("id, action, entity_type, actor_user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (!rows || rows.length === 0) {
    return <BlankScreen title="활동 기록" note="아직 기록된 활동이 없습니다." />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">활동 기록</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>시각</TableHead>
            <TableHead>누가</TableHead>
            <TableHead>무엇을</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="text-muted-foreground">
                {formatDateTime(row.created_at, "ko")}
              </TableCell>
              <TableCell>{row.actor_user_id === user?.id ? "나" : row.actor_user_id?.slice(0, 8)}</TableCell>
              <TableCell>{ACTION_LABEL[row.action] ?? row.action}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
