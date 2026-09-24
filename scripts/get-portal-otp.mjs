// 대리인 포털(/portal-login) 테스트용 인증번호를 이메일 없이 바로 발급합니다.
// Supabase 프로젝트의 기본 이메일 발송은 시간당 발송 한도가 매우 낮아서(커스텀 SMTP
// 미설정 시) 개발 중 이메일이 안 올 때가 많습니다 — 이 스크립트는 이메일 발송을
// 거치지 않고 admin API로 같은 인증번호를 바로 받아옵니다(우리 앱의 verifyOtp와
// 100% 같은 방식으로 검증됨, 확인 완료).
// 실행: node scripts/get-portal-otp.mjs <이메일> (기본값: choby.pm+proxy@gmail.com)
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

const email = process.argv[2] || "choby.pm+proxy@gmail.com";

const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) {
  console.error("발급 실패:", error.message);
  process.exit(1);
}
console.log(`\n${email} 로그인용 인증번호: ${data.properties.email_otp}\n`);
console.log("/portal-login 에서 이메일 입력 → 다음 화면에서 위 번호를 입력하세요.");
console.log("(1회용입니다. 다시 필요하면 이 스크립트를 다시 실행하세요.)");
