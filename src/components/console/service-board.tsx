"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { BlankScreen } from "@/components/shared/blank-screen";
import { createServiceItem, deleteServiceItem } from "@/server/modules/service-item/actions";
import { formatDateTime } from "@/lib/date";
import {
  SERVICE_TYPES,
  SUPPORT_TYPE_LABEL,
  SERVICE_STATUS_LABEL as STATUS_LABEL,
  SERVICE_STATUS_BADGE as STATUS_BADGE,
  SERVICE_TYPE_COLUMN_LABELS,
} from "@/lib/service-item-constants";

interface ServiceItemRow {
  id: string;
  service_type: string;
  status: string;
  support_type: string | null;
  scheduled_at: string | null;
  delegation: { id: string; name: string } | null;
  event_vendor: { id: string; vendor: { name: string } | null } | null;
}
interface DelegationOption { id: string; name: string }
interface EventVendorOption { id: string; service_types: string[]; vendor: { name: string } | null }

function AddServiceItemDialog({
  eventId,
  serviceType,
  delegations,
  eventVendors,
  open,
  onOpenChange,
}: {
  eventId: string;
  serviceType: string;
  delegations: DelegationOption[];
  eventVendors: EventVendorOption[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const vendorsForType = eventVendors.filter((v) => v.service_types.includes(serviceType));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={createServiceItem} onSubmit={() => onOpenChange(false)}>
          <DialogHeader>
            <DialogTitle>{SERVICE_TYPES.find((t) => t.value === serviceType)?.label} 항목 추가</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="serviceType" value={serviceType} />
          <div className="flex flex-col gap-3 py-4">
            <div className="flex flex-col gap-1.5">
              <Label>대표단</Label>
              <Select name="delegationId" required>
                <SelectTrigger className="w-full"><SelectValue placeholder="대표단 선택" /></SelectTrigger>
                <SelectContent>
                  {delegations.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>지원 방식</Label>
              <Select name="supportType">
                <SelectTrigger className="w-full"><SelectValue placeholder="선택 안 함" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SUPPORT_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>담당 업체</Label>
              <Select name="eventVendorId">
                <SelectTrigger className="w-full"><SelectValue placeholder="미지정" /></SelectTrigger>
                <SelectContent>
                  {vendorsForType.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.vendor?.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scheduledAt">{SERVICE_TYPE_COLUMN_LABELS[serviceType].scheduled} (선택)</Label>
              <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
            <Button type="submit">추가</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ServiceTypeTable({
  eventId,
  serviceType,
  items,
  delegations,
  eventVendors,
}: {
  eventId: string;
  serviceType: string;
  items: ServiceItemRow[];
  delegations: DelegationOption[];
  eventVendors: EventVendorOption[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const columns = SERVICE_TYPE_COLUMN_LABELS[serviceType];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          항목 추가
        </Button>
      </div>
      {items.length === 0 ? (
        <BlankScreen title="아직 항목이 없습니다" note="대리인 요청 입력 화면은 다음 조각에서 연결합니다. 지금은 PCO가 직접 추가할 수 있습니다." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>대표단</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>지원 방식</TableHead>
              <TableHead>{columns.vendor}</TableHead>
              <TableHead>{columns.scheduled}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.delegation?.name}</TableCell>
                <TableCell>
                  <StatusBadge status={STATUS_BADGE[item.status]}>{STATUS_LABEL[item.status]}</StatusBadge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.support_type ? SUPPORT_TYPE_LABEL[item.support_type] : "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">{item.event_vendor?.vendor?.name ?? "미지정"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {item.scheduled_at ? formatDateTime(item.scheduled_at, "ko") : "-"}
                </TableCell>
                <TableCell>
                  {item.status === "DRAFT" && (
                    <form action={deleteServiceItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="eventId" value={eventId} />
                      {item.delegation?.id && (
                        <input type="hidden" name="delegationId" value={item.delegation.id} />
                      )}
                      <Button type="submit" variant="ghost" size="icon-sm">
                        <X className="size-4" />
                      </Button>
                    </form>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <AddServiceItemDialog
        eventId={eventId}
        serviceType={serviceType}
        delegations={delegations}
        eventVendors={eventVendors}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
    </div>
  );
}

export function ServiceBoard({
  eventId,
  items,
  delegations,
  eventVendors,
}: {
  eventId: string;
  items: ServiceItemRow[];
  delegations: DelegationOption[];
  eventVendors: EventVendorOption[];
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">서비스 현황</h1>
      <Tabs defaultValue="FLIGHT">
        <TabsList variant="line" className="h-10 w-full justify-start border-b">
          {SERVICE_TYPES.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="px-3 text-sm">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {SERVICE_TYPES.map((t) => (
          <TabsContent key={t.value} value={t.value} className="pt-4">
            <ServiceTypeTable
              eventId={eventId}
              serviceType={t.value}
              items={items.filter((i) => i.service_type === t.value)}
              delegations={delegations}
              eventVendors={eventVendors}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
