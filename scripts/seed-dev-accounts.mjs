// 개발용 테스트 계정 + 샘플 데이터 시드 스크립트. 여러 번 실행해도 안전합니다(이미
// 있으면 재사용). 실행: node scripts/seed-dev-accounts.mjs (또는 npm run seed:dev).
// 개발/스테이징 전용 — 실제 개인정보는 절대 넣지 않습니다(CLAUDE.md 원칙).
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

const PASSWORD = "Test-password-123!";
const PCO_EMAIL = "choby.pm+pco@gmail.com";
const VENDOR_EMAIL = "choby.pm+vendor@gmail.com";
const PROXY_EMAIL = "choby.pm+proxy@gmail.com";

async function getOrCreateUser(email) {
  // 이미 있으면 재사용 (여러 번 돌려도 안전하게)
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list.users.find((u) => u.email === email);
  if (existing) return existing;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  return data.user;
}

const pcoUser = await getOrCreateUser(PCO_EMAIL);
const vendorUser = await getOrCreateUser(VENDOR_EMAIL);
const proxyUser = await getOrCreateUser(PROXY_EMAIL);

// 기존 테스트 테넌트가 있으면 재사용
let { data: tenant } = await admin.from("tenant").select("*").eq("name", "샘플 PCO (테스트용)").maybeSingle();
if (!tenant) {
  const { data } = await admin.from("tenant").insert({ name: "샘플 PCO (테스트용)" }).select().single();
  tenant = data;
}
const { error: tmErr } = await admin.from("tenant_member").upsert(
  { tenant_id: tenant.id, user_id: pcoUser.id, role: "PCO_ADMIN" },
  { onConflict: "tenant_id,user_id" },
);
if (tmErr) throw tmErr;

const pcoClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
await pcoClient.auth.signInWithPassword({ email: PCO_EMAIL, password: PASSWORD });

let { data: event } = await pcoClient.from("event").select("*").eq("tenant_id", tenant.id).eq("name", "샘플 정상회의").maybeSingle();
if (!event) {
  const { data, error } = await pcoClient
    .from("event")
    .insert({ tenant_id: tenant.id, name: "샘플 정상회의", status: "ACTIVE" })
    .select()
    .single();
  if (error) throw error;
  event = data;
}

let { data: delegation } = await pcoClient.from("delegation").select("*").eq("event_id", event.id).eq("name", "샘플 대표단").maybeSingle();
if (!delegation) {
  const { data, error } = await pcoClient
    .from("delegation")
    .insert({ tenant_id: tenant.id, event_id: event.id, name: "샘플 대표단", country: "VN", organization: "샘플 정부기관" })
    .select()
    .single();
  if (error) throw error;
  delegation = data;
}

// 대리인 연결
const { error: proxyErr } = await admin.from("delegation_proxy").upsert(
  { tenant_id: tenant.id, delegation_id: delegation.id, user_id: proxyUser.id, status: "ACTIVE" },
  { onConflict: "delegation_id,user_id" },
);
if (proxyErr) throw proxyErr;

// 참가자 2명
const { data: existingParticipants } = await pcoClient.from("participant").select("*").eq("delegation_id", delegation.id);
if (!existingParticipants || existingParticipants.length === 0) {
  await pcoClient.from("participant").insert([
    { tenant_id: tenant.id, delegation_id: delegation.id, participant_type: "VIP", last_name: "Nguyen", first_name: "Van A", nationality: "VN" },
    { tenant_id: tenant.id, delegation_id: delegation.id, participant_type: "STAFF", last_name: "Tran", first_name: "Thi B", nationality: "VN" },
  ]);
}

// 업체 3종(항공/숙박/수송) 한 계정으로 다 담당하게
let { data: vendor } = await pcoClient.from("vendor").select("*").eq("name", "샘플 종합업체").maybeSingle();
if (!vendor) {
  const { data } = await pcoClient.from("vendor").insert({ name: "샘플 종합업체" }).select().single();
  vendor = data;
}
let { data: eventVendor } = await pcoClient.from("event_vendor").select("*").eq("event_id", event.id).eq("vendor_id", vendor.id).maybeSingle();
if (!eventVendor) {
  const { data } = await pcoClient
    .from("event_vendor")
    .insert({ tenant_id: tenant.id, event_id: event.id, vendor_id: vendor.id, service_types: ["FLIGHT", "LODGING", "TRANSFER", "AIRPORT", "DIETARY"] })
    .select()
    .single();
  eventVendor = data;
}
const { error: vmErr } = await admin.from("vendor_member").upsert(
  { vendor_id: vendor.id, user_id: vendorUser.id, role: "ADMIN" },
  { onConflict: "vendor_id,user_id" },
);
if (vmErr) throw vmErr;

// 서비스 항목에 업체 배정 + 항공을 REQUESTED로 (업체 화면에서 "착수" 눌러볼 거리 만들어두기)
const { data: serviceItems } = await pcoClient.from("service_item").select("*").eq("delegation_id", delegation.id);
for (const item of serviceItems ?? []) {
  await pcoClient.from("service_item").update({ event_vendor_id: eventVendor.id }).eq("id", item.id);
}
const flightItem = serviceItems?.find((i) => i.service_type === "FLIGHT");
if (flightItem) {
  await pcoClient.from("service_item").update({ status: "REQUESTED", note: "인천 도착 희망 3/1" }).eq("id", flightItem.id).eq("status", "DRAFT");
}

// 하위 행사 하나 (가안) - R5 화면 확인용
let { data: program } = await pcoClient.from("program").select("*").eq("event_id", event.id).eq("name", "환영 만찬").maybeSingle();
if (!program) {
  const { data } = await pcoClient
    .from("program")
    .insert({ tenant_id: tenant.id, event_id: event.id, name: "환영 만찬", program_type: "BANQUET", organizer_type: "HOST", visibility: "STAKEHOLDER", start_at: "2027-03-01T10:00:00Z", venue: "샘플 호텔" })
    .select()
    .single();
  program = data;
  const { data: participants } = await pcoClient.from("participant").select("id").eq("delegation_id", delegation.id);
  for (const p of participants ?? []) {
    await pcoClient.from("program_attendance").insert({ tenant_id: tenant.id, program_id: program.id, participant_id: p.id, role: "ATTENDEE" });
  }
}

console.log("=== 완료 ===");
console.log("PCO 로그인 (/console-login):", PCO_EMAIL, "/", PASSWORD);
console.log("업체 로그인 (/vendor-login):", VENDOR_EMAIL, "/", PASSWORD);
console.log("대리인 로그인 (/portal-login):", PROXY_EMAIL, "(비밀번호 없음, 이메일로 받는 인증번호 입력)");
console.log("행사:", event.name, "/ 대표단:", delegation.name);
