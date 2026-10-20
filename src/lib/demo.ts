export const DEMO_ROLES = [
  { role: "pco", label: "PCO 관리자", description: "행사·대표단·서비스·팀 관리", path: "/console" },
  { role: "manager", label: "PCO 담당자", description: "행사 운영·업체 배정·변경 조정", path: "/console" },
  { role: "field", label: "현장 직원", description: "현장 명단과 서비스 조회", path: "/console" },
  { role: "vendor", label: "항공 담당 업체", description: "항공 요청·예약·발권·확정·조정 작업", path: "/vendor" },
  { role: "proxy", label: "베트남 대표단 대리인", description: "자기 대표단의 참석 회신·서비스 요청·동의·일정", path: "/portal" },
] as const;

export type DemoRole = (typeof DEMO_ROLES)[number]["role"];

export function isDemoMode() {
  return process.env.DEMO_MODE !== "false";
}
