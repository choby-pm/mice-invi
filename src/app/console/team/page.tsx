import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/server/modules/org/get-membership";
import { inviteStaff } from "@/server/modules/iam/invite-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/date";

const ROLE_LABEL: Record<string, string> = {
  PCO_ADMIN: "관리자",
  PCO_MANAGER: "담당자",
  PCO_FIELD: "현장 스태프 (조회 전용)",
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string }>;
}) {
  const { error, invited } = await searchParams;
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const supabase = await createServerSupabaseClient();
  const { data: members } = await supabase
    .from("tenant_member")
    .select("id, user_id, role, created_at")
    .order("created_at", { ascending: true });

  const admin = createAdminClient();
  const rows = await Promise.all(
    (members ?? []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      return { ...m, email: data.user?.email ?? "(알 수 없음)" };
    }),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">팀 관리</h1>

      {membership.role === "PCO_ADMIN" && (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-base">직원 초대</CardTitle>
            <CardDescription>초대 메일이 발송됩니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="mb-3 rounded-md bg-status-urgent-bg px-3 py-2 text-sm text-status-urgent-fg">
                {error}
              </p>
            )}
            {invited && (
              <p className="mb-3 rounded-md bg-status-done-bg px-3 py-2 text-sm text-status-done-fg">
                {invited}님에게 초대 메일을 보냈습니다.
              </p>
            )}
            <form action={inviteStaff} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invite-email">이메일</Label>
                <Input id="invite-email" name="email" type="email" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>역할</Label>
                <Select name="role" defaultValue="PCO_MANAGER">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PCO_ADMIN">관리자</SelectItem>
                    <SelectItem value="PCO_MANAGER">담당자</SelectItem>
                    <SelectItem value="PCO_FIELD">현장 스태프 (조회 전용)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="mt-1">초대 보내기</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이메일</TableHead>
            <TableHead>역할</TableHead>
            <TableHead>합류일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.email}</TableCell>
              <TableCell>{ROLE_LABEL[row.role] ?? row.role}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(row.created_at, "ko")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
