import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

export type StatusBadgeStatus =
  | "urgent"
  | "action"
  | "progress"
  | "done"
  | "wait"
  | "void";

const STATUS_CLASS: Record<StatusBadgeStatus, string> = {
  urgent: "bg-status-urgent-bg text-status-urgent-fg",
  action: "bg-status-action-bg text-status-action-fg",
  progress: "bg-status-progress-bg text-status-progress-fg",
  done: "bg-status-done-bg text-status-done-fg",
  wait: "bg-status-wait-bg text-status-wait-fg",
  void: "bg-status-wait-bg text-status-wait-fg line-through",
};

interface StatusBadgeProps {
  status: StatusBadgeStatus;
  children: React.ReactNode;
  /** 카운트 배지 등 눈에 띄어야 할 때만 진한 색(urgent만 지원, 07 §3) */
  strong?: boolean;
  className?: string;
}

export function StatusBadge({ status, children, strong, className }: StatusBadgeProps) {
  const strongClass = strong && status === "urgent" ? "bg-status-urgent text-white" : STATUS_CLASS[status];
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", strongClass, className)}>
      {children}
    </Badge>
  );
}
