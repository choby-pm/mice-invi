"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ServiceDetails, type ServiceDetailsItem } from "@/components/shared/service-details";
import { SERVICE_TYPES, SERVICE_STATUS_BADGE, SERVICE_STATUS_LABEL } from "@/lib/service-item-constants";

export function ServiceDetailDialog({ item }: { item: ServiceDetailsItem }) {
  const type = SERVICE_TYPES.find((s) => s.value === item.service_type)?.label;
  return <Dialog>
    <DialogTrigger render={<Button variant="outline" size="sm" />}>상세 보기</DialogTrigger>
    <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
      <DialogHeader className="border-b px-6 py-5 pr-12">
        <DialogTitle className="flex flex-wrap items-center gap-3 text-xl">{item.delegation?.name ?? "서비스"} · {type}<StatusBadge status={SERVICE_STATUS_BADGE[item.status]}>{SERVICE_STATUS_LABEL[item.status]}</StatusBadge></DialogTitle>
        <DialogDescription>{item.delegation?.event?.name ?? "고객 요청과 업체 처리 결과"}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 p-4 sm:p-6"><ServiceDetails item={item} /></div>
    </DialogContent>
  </Dialog>;
}
