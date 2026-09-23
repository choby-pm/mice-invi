"use client";

import { Button } from "@/components/ui/button";
import { updateRsvp } from "@/server/modules/delegation/rsvp-actions";

export function RsvpBanner({
  delegationId,
  rsvp,
  revalidateTo,
}: {
  delegationId: string;
  rsvp: string | null;
  revalidateTo: string;
}) {
  if (rsvp === "ATTENDING") return null; // 참석 확정이면 배너를 굳이 안 보여줌

  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      {rsvp === "DECLINED" ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">불참으로 회신되어 있습니다.</p>
          <form action={updateRsvp}>
            <input type="hidden" name="delegationId" value={delegationId} />
            <input type="hidden" name="rsvp" value="ATTENDING" />
            <input type="hidden" name="revalidateTo" value={revalidateTo} />
            <Button type="submit" variant="outline" size="sm">참석으로 바꾸기</Button>
          </form>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">참석 여부를 알려주세요.</p>
          <div className="flex gap-2">
            <form action={updateRsvp}>
              <input type="hidden" name="delegationId" value={delegationId} />
              <input type="hidden" name="rsvp" value="ATTENDING" />
              <input type="hidden" name="revalidateTo" value={revalidateTo} />
              <Button type="submit" size="sm">참석합니다</Button>
            </form>
            <form action={updateRsvp}>
              <input type="hidden" name="delegationId" value={delegationId} />
              <input type="hidden" name="rsvp" value="DECLINED" />
              <input type="hidden" name="revalidateTo" value={revalidateTo} />
              <Button type="submit" variant="outline" size="sm">불참합니다</Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
