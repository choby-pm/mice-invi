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

// 분야별로 다르게 읽어야 하는 열 이름 (데이터는 같은 service_item이지만 표시만 맞춤)
export const SERVICE_TYPE_COLUMN_LABELS: Record<string, { scheduled: string; vendor: string }> = {
  FLIGHT: { scheduled: "희망 입국일시", vendor: "담당 항공사" },
  LODGING: { scheduled: "체크인 예정", vendor: "담당 호텔" },
  TRANSFER: { scheduled: "픽업 예정 시각", vendor: "담당 수송업체" },
  AIRPORT: { scheduled: "의전 예정 시각", vendor: "담당 업체" },
  DIETARY: { scheduled: "제공 예정 시각", vendor: "담당 업체" },
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
