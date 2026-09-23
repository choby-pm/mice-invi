"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { submitConsent } from "@/server/modules/consent/portal-actions";
import type { ConsentItemWithStatus } from "@/server/modules/consent/portal-actions";

const CATEGORY_LABEL: Record<string, string> = {
  REQUIRED: "필수",
  OPTIONAL: "선택",
  SENSITIVE: "민감정보",
  UNIQUE_ID: "고유식별정보",
  OVERSEAS_TRANSFER: "국외 이전",
  REUSE_STORAGE: "재사용 보관",
};

export function ConsentChecklist({
  delegationId,
  participantId,
  policyVersion,
  noticeKo,
  items,
  revalidateTo,
}: {
  delegationId: string;
  participantId: string;
  policyVersion: number;
  noticeKo?: string;
  items: ConsentItemWithStatus[];
  revalidateTo: string;
}) {
  const allAgreed = items.every((i) => i.agreed);

  return (
    <form action={submitConsent} className="flex flex-col gap-3">
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="delegationId" value={delegationId} />
      <input type="hidden" name="policyVersion" value={policyVersion} />
      <input type="hidden" name="revalidateTo" value={revalidateTo} />

      {noticeKo && <p className="text-sm text-muted-foreground">{noticeKo}</p>}

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 rounded-md border p-3">
            <Checkbox id={`ci-${item.id}`} name="itemIds" value={item.id} defaultChecked={item.agreed} className="mt-0.5" />
            <Label htmlFor={`ci-${item.id}`} className="flex-1 font-normal">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="outline">{CATEGORY_LABEL[item.category]}</Badge>
                {item.required && <span className="text-xs text-status-urgent-fg">필수</span>}
                {item.agreed && <span className="text-xs text-status-done-fg">동의함</span>}
              </div>
              <span className="text-sm">{item.text?.ko}</span>
            </Label>
          </li>
        ))}
      </ul>

      <Button type="submit">{allAgreed ? "동의 내용 다시 저장" : "동의하고 저장"}</Button>
    </form>
  );
}
