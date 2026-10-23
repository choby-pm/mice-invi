// 업체 데모는 분야마다 별도 계정·업체입니다. 항공은 기존 계정(demo-vendor)을 그대로 씁니다.
export const DEMO_ROLES = [
  { role: "pco", group: "PCO", label: "PCO 관리자", description: "행사·대표단·서비스·팀 관리", path: "/console" },
  { role: "manager", group: "PCO", label: "PCO 담당자", description: "행사 운영·업체 배정·변경 조정", path: "/console" },
  { role: "field", group: "PCO", label: "현장 직원", description: "현장 명단과 서비스 조회", path: "/console" },
  { role: "proxy", group: "VIP", label: "베트남 대표단 대리인", description: "참석 회신·서비스 요청·동의·일정", path: "/portal" },
  { role: "vendor", group: "VENDOR", serviceType: "FLIGHT", label: "항공 · 하늘여행", description: "항공 요청·예약·발권·확정", path: "/vendor" },
  { role: "vendor-lodging", group: "VENDOR", serviceType: "LODGING", label: "호텔 · 서울컨벤션호텔", description: "객실 요청·배정·확정", path: "/vendor" },
  { role: "vendor-transfer", group: "VENDOR", serviceType: "TRANSFER", label: "운송 · 의전모빌리티", description: "차량 요청·배차·변경 대응", path: "/vendor" },
  { role: "vendor-airport", group: "VENDOR", serviceType: "AIRPORT", label: "공항 의전 · 공항컨시어지", description: "입출국 영접·수하물 지원", path: "/vendor" },
  { role: "vendor-dietary", group: "VENDOR", serviceType: "DIETARY", label: "F&B · 그린케이터링", description: "식이 요청 확인·식음 준비", path: "/vendor" },
] as const;

export const DEMO_GROUPS = [
  { group: "PCO", title: "PCO (행사 운영사)" },
  { group: "VIP", title: "VIP 측 (대표단 대리인)" },
  { group: "VENDOR", title: "협력 업체" },
] as const;

export type DemoRole = (typeof DEMO_ROLES)[number]["role"];

export function demoVendorType(role: DemoRole) {
  const option = DEMO_ROLES.find((entry) => entry.role === role);
  return option && "serviceType" in option ? option.serviceType : null;
}

export function isDemoMode() {
  return process.env.DEMO_MODE !== "false";
}

// 데모에서는 탭마다 역할이 다릅니다. 브라우저는 지금 조작 중인 탭의 역할만 이 쿠키에 적고,
// 로그인 세션은 서버가 역할별로 보관합니다 (server/auth/demo-session.ts).
export const DEMO_TAB_COOKIE = "demo_tab_role";

export function demoTabRole(value: string | undefined): DemoRole | null {
  return isDemoMode() && DEMO_ROLES.some((entry) => entry.role === value) ? (value as DemoRole) : null;
}
