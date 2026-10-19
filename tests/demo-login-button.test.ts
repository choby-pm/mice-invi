import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { DemoLoginButton } from "@/components/shared/demo-login-button";

const status = vi.hoisted(() => ({ pending: false }));
vi.mock("react-dom", async (original) => ({
  ...await original<typeof import("react-dom")>(),
  useFormStatus: () => status,
}));

it("입장 요청 중에는 버튼을 잠그고 진행 상태를 알림", () => {
  status.pending = true;
  const html = renderToStaticMarkup(createElement(DemoLoginButton, { label: "PCO 관리자", description: "행사 운영" }));
  expect(html).toContain("disabled");
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain("PCO 관리자 입장 중…");
});

it("대기 중에는 역할 입장 버튼을 사용할 수 있음", () => {
  status.pending = false;
  const html = renderToStaticMarkup(createElement(DemoLoginButton, { label: "현장 직원", description: "명단 조회" }));
  expect(html).not.toContain('disabled=""');
  expect(html).toContain("현장 직원 체험하기");
});
