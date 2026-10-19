import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="w-full space-y-4 p-6">
      <span className="sr-only">화면을 불러오는 중입니다.</span>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
