import Link from "next/link";
import { getVendorContext } from "@/server/auth/vendor-context";
import { SERVICE_TYPES } from "@/lib/service-item-constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function VendorAccountPage() {
  const { user, memberships, assignments, flightDemo } = await getVendorContext();
  return <div className="max-w-4xl space-y-4">
    <h1 className="text-lg font-semibold">내 정보</h1>
    <p className="text-sm text-muted-foreground">{user.email}{flightDemo && " · 항공 업체 데모"}</p>
    {memberships.map((m) => <Card key={m.vendor.id}>
      <CardHeader><CardTitle>{m.vendor.name}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">내 역할: {m.role === "ADMIN" ? "업체 관리자" : "업체 직원"}</p>
      </CardContent>
    </Card>)}
    <h2 className="font-medium">서비스가 등록된 담당 행사</h2>
    {assignments.map((a) => <div key={a.id} className="rounded-md border p-3 text-sm">
      <p>{a.event?.name ?? "행사 정보 없음"}{a.event?.status === "CLOSED" && " · 종료"}</p>
      <p className="text-muted-foreground">{a.service_types.map((t) => SERVICE_TYPES.find((s) => s.value === t)?.label ?? t).join(" · ")}</p>
    </div>)}
    {assignments.length === 0 && <p className="text-sm text-muted-foreground">아직 등록된 담당 서비스가 없습니다.</p>}
    {memberships.length === 0 && <p className="text-sm">연결된 업체가 없습니다. PCO 담당자에게 업체 배정을 요청해 주세요.</p>}
    <Link className="text-sm underline" href="/vendor/history">처리 내역 보기</Link>
  </div>;
}
