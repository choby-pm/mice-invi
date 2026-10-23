import { NextResponse, type NextRequest } from "next/server";
import { demoLogin } from "@/server/auth/demo-login";

// 데모 버튼은 새 탭 링크(GET)입니다. 일부 브라우저·미리보기 창은 새 탭 POST를 GET으로 바꿔 빈 화면이 됩니다.
// shortcut: 데모 전용 GET 입장이라 외부 링크로도 데모 계정 입장이 됩니다. DEMO_MODE=false면 /login으로만 보냅니다.
export async function GET(request: NextRequest) {
  const form = new FormData();
  form.set("role", request.nextUrl.searchParams.get("role") ?? "");
  const path = await demoLogin(form);
  return NextResponse.redirect(new URL(path, request.url), 303);
}
