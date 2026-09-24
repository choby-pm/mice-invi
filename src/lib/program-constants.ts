import type { StatusBadgeStatus } from "@/components/shared/status-badge";

// 01 §P02-C 하위 행사 유형
export const PROGRAM_TYPE_LABEL: Record<string, string> = {
  PLENARY: "본회의·세션",
  BANQUET: "공식 연회",
  BILATERAL: "양자·다자 면담",
  DELEGATION_HOSTED: "대표단 주관 행사",
  COMPANION: "동반자 프로그램",
  PROTOCOL: "의전 행사",
  SELF_SCHEDULED: "대표단 자체 일정",
};

export const ORGANIZER_TYPE_LABEL: Record<string, string> = {
  HOST: "주최측",
  DELEGATION: "대표단",
  PCO: "PCO",
};

export const VISIBILITY_LABEL: Record<string, string> = {
  PUBLIC: "전체 공개",
  STAKEHOLDER: "관계자 한정",
  PRIVATE: "비공개",
};

// 01 §S12 하위 행사 상태
export const PROGRAM_STATUS_LABEL: Record<string, string> = {
  TENTATIVE: "가안",
  CONFIRMED: "확정",
  DONE: "종료",
  CANCELLED: "취소",
};
export const PROGRAM_STATUS_BADGE: Record<string, StatusBadgeStatus> = {
  TENTATIVE: "wait",
  CONFIRMED: "done",
  DONE: "void",
  CANCELLED: "void",
};

export const ATTENDANCE_ROLE_LABEL: Record<string, string> = {
  HOST: "주관",
  SPEAKER: "발표자",
  ATTENDEE: "참석",
  STAFF_SUPPORT: "수행",
  SPECIAL_EVENT: "특별 이벤트",
};

// 01 §S13 하위 행사 참석 상태
export const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  INVITED: "초청됨",
  CONFIRMED: "참석 확정",
  DECLINED: "불참",
};
export const ATTENDANCE_STATUS_BADGE: Record<string, StatusBadgeStatus> = {
  INVITED: "wait",
  CONFIRMED: "done",
  DECLINED: "void",
};
