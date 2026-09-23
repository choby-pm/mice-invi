import type { StatusBadgeStatus } from "@/components/shared/status-badge";

export const SERVICE_TYPES = [
  { value: "FLIGHT", label: "항공" },
  { value: "LODGING", label: "숙박" },
  { value: "TRANSFER", label: "수송" },
  { value: "AIRPORT", label: "공항 의전" },
  { value: "DIETARY", label: "식음" },
] as const;

export const SUPPORT_TYPE_LABEL: Record<string, string> = {
  SUPPORTED: "지원",
  SELF_BOOKED: "자비·직접 예약",
  PREPAID_REIMBURSE: "선결제 후 환급",
  SELF_PAID_ARRANGED: "자비·예약 대행",
  NOT_PROVIDED: "제공 안 함",
};

// 01 문서 S04 상태표 그대로 (요청 전 ~ 취소 완료)
export const SERVICE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "요청 전",
  REQUESTED: "요청됨",
  IN_PROGRESS: "처리중",
  CONFIRMED: "확정",
  NOTIFIED: "안내 완료",
  CHANGING: "변경 처리중",
  CANCEL_REQ: "취소 요청",
  CANCELLED: "취소 완료",
  NOT_APPLICABLE: "해당 없음",
};

export const SERVICE_STATUS_BADGE: Record<string, StatusBadgeStatus> = {
  DRAFT: "wait",
  REQUESTED: "wait",
  IN_PROGRESS: "progress",
  CONFIRMED: "done",
  NOTIFIED: "done",
  CHANGING: "action",
  CANCEL_REQ: "urgent",
  CANCELLED: "void",
  NOT_APPLICABLE: "void",
};
