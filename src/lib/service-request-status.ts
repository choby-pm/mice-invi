export function requestStatus(current: string, changed: boolean) {
  if (["CANCELLED", "CANCEL_REQ", "NOT_APPLICABLE"].includes(current)) throw new Error("취소 또는 지원 제외된 요청은 수정할 수 없습니다. 담당자에게 문의해 주세요.");
  if (current === "DRAFT") return "REQUESTED";
  if (changed && ["CONFIRMED", "NOTIFIED"].includes(current)) return "CHANGING";
  return current;
}

export function requestChanged(previous: Record<string, unknown> | null | undefined, next: Record<string, unknown>) {
  return Object.entries(next).some(([key, value]) => JSON.stringify(previous?.[key] ?? null) !== JSON.stringify(value ?? null));
}
