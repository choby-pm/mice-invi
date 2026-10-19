"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DemoLoginButton({ label, description }: { label: string; description: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending} aria-busy={pending} className="h-auto w-full justify-start py-3">
      {pending && <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />}
      <span className="flex flex-col items-start gap-1 whitespace-normal text-left" aria-live="polite">
        <span className="font-medium">{pending ? `${label} 입장 중…` : `${label} 체험하기`}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </Button>
  );
}
