import type { StatusBadgeStatus } from "@/components/shared/status-badge";

// 01 §S05 변경 이슈 상태
export const ISSUE_STATUS_LABEL: Record<string, string> = {
  OPEN: "열림",
  IN_PROGRESS: "진행중",
  CLOSED: "종결",
  SUPERSEDED: "대체됨",
  FORCE_CLOSED: "강제 종결",
};
export const ISSUE_STATUS_BADGE: Record<string, StatusBadgeStatus> = {
  OPEN: "action",
  IN_PROGRESS: "progress",
  CLOSED: "done",
  SUPERSEDED: "void",
  FORCE_CLOSED: "void",
};

// 01 §S06 조정 항목 상태
export const ADJUSTMENT_STATUS_LABEL: Record<string, string> = {
  WAITING: "대기",
  ACTION_REQUIRED: "조치 필요",
  IN_PROGRESS: "처리중",
  DONE: "완료",
  NOT_APPLICABLE: "해당 없음",
  VOID: "무효",
};
export const ADJUSTMENT_STATUS_BADGE: Record<string, StatusBadgeStatus> = {
  WAITING: "wait",
  ACTION_REQUIRED: "urgent",
  IN_PROGRESS: "progress",
  DONE: "done",
  NOT_APPLICABLE: "void",
  VOID: "void",
};

export const URGENCY_LABEL: Record<string, string> = {
  URGENT: "긴급",
  CAUTION: "주의",
  NORMAL: "일반",
};
export const URGENCY_BADGE: Record<string, StatusBadgeStatus> = {
  URGENT: "urgent",
  CAUTION: "action",
  NORMAL: "wait",
};

export const SOURCE_LABEL: Record<string, string> = {
  PROXY: "대리인",
  VENDOR: "업체",
  PCO: "PCO",
  HOST: "주최측 요청",
  SYSTEM: "시스템",
};

export const SERVICE_TYPE_LABEL_SHORT: Record<string, string> = {
  FLIGHT: "항공",
  LODGING: "숙박",
  TRANSFER: "수송",
  AIRPORT: "공항 의전",
  DIETARY: "식음",
};
