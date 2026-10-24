import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { buildDemoData, demoId, DEMO_USER_ROLES } from "./demo-data.mjs";

config({ path: ".env.local", quiet: true });
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--apply")) throw new Error("사용법: npm run seed:demo -- [--apply]");
const emails = Object.fromEntries(DEMO_USER_ROLES.map((role) =>
  [role, `choby.pm+demo-${role}@gmail.com`]));
const preview = buildDemoData(Object.fromEntries(Object.keys(emails).map((role) => [role, demoId(`user:${role}`)])));
console.table(Object.entries(preview).map(([table, rows]) => ({ table, rows: rows.length })));
if (!args.includes("--apply")) {
  console.log("미리보기만 완료했습니다. DB에 생성하려면 npm run seed:demo -- --apply");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !secret || !publishable) throw new Error(".env.local의 Supabase URL·관리자 키·공개 키가 필요합니다.");
const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(url, secret, options);
const pco = createClient(url, publishable, options);
const password = process.env.DEMO_PASSWORD || `Demo-${randomBytes(18).toString("base64url")}!`;
const users = {};
const newRoles = [];
const existingUsers = [];
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  existingUsers.push(...data.users);
  if (data.users.length < 1000) break;
}
for (const [role, email] of Object.entries(emails)) {
  const existing = existingUsers.find((user) => user.email === email);
  if (existing && existing.app_metadata?.demo_seed !== "mice-invi-v1") {
    throw new Error(`${email}: 데모 스크립트가 만든 계정이 아니므로 연결하지 않습니다.`);
  }
  if (existing) users[role] = existing.id;
  else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true,
      app_metadata: { demo_seed: "mice-invi-v1" } });
    if (error) throw error;
    users[role] = data.user.id;
    newRoles.push(role);
    console.log(`새 데모 계정: ${email} / 비밀번호: ${password}`);
  }
}

async function insertMissing(table, rows) {
  // Ignore existing IDs so re-running never resets actions performed during a demo.
  const { error } = await admin.from(table).upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(`${table}: ${error.message}`);
}

let tables = buildDemoData(users);
for (const table of ["tenant", "tenant_member", "event", "protocol_level", "vendor", "event_vendor", "vendor_member", "support_policy", "delegation", "delegation_proxy", "participant"]) {
  await insertMissing(table, tables[table]);
}

// Delegation INSERT triggers create four draft services with random IDs. Reuse those IDs.
const { data: defaults, error: defaultsError } = await admin.from("service_item").select("id, delegation_id, service_type, status, note")
  .eq("tenant_id", demoId("tenant"));
if (defaultsError) throw defaultsError;
const serviceIds = {};
for (const delegation of tables.delegation) {
  for (const type of ["FLIGHT", "LODGING", "AIRPORT", "DIETARY"]) {
    const item = defaults.find((row) => row.delegation_id === delegation.id && row.service_type === type);
    if (item) serviceIds[`${delegation.id}:${type}`] = item.id;
  }
}
tables = buildDemoData(users, serviceIds);
const seedStartedAt = new Date().toISOString();
for (const row of tables.service_item) {
  const existing = defaults.find((item) => item.id === row.id);
  if (!existing) await insertMissing("service_item", [row]);
  else if (existing.status === "DRAFT" && existing.note === null) {
    const { error } = await admin.from("service_item").update(row).eq("id", row.id).eq("status", "DRAFT").is("note", null);
    if (error) throw new Error(`service_item: ${error.message}`);
  }
}
for (const table of ["flight_request", "flight_segment", "lodging_request", "room_assignment", "airport_request", "airport_assignment",
  "dietary_requirement", "vehicle_dispatch", "consent_policy", "consent_item", "consent_record", "program", "program_attendance",
  "transfer_request", "change_issue", "adjustment_item"]) {
  await insertMissing(table, tables[table]);
}

// 자동 생성 서비스를 데모 단계로 바꿀 때 트리거가 남긴 "최근 변경" 알림은 실제 변경이 아니므로 지웁니다.
const seededServiceIds = tables.service_item.map((row) => row.id);
for (let i = 0; i < seededServiceIds.length; i += 100) {
  const { error } = await admin.from("service_update").delete().gte("created_at", seedStartedAt).in("service_item_id", seededServiceIds.slice(i, i + 100));
  if (error) throw new Error(`service_update: ${error.message}`);
}

// Authenticate without sending email; sensitive demo values use the same encryption RPC as the app.
const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: emails.pco });
if (linkError) throw linkError;
const { error: sessionError } = await pco.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
if (sessionError) throw sessionError;
for (const participant of tables.participant.slice(0, 3)) {
  const { data: existing, error } = await admin.from("participant_sensitive").select("participant_id").eq("participant_id", participant.id).maybeSingle();
  if (error) throw error;
  if (existing) continue;
  const { error: writeError } = await pco.rpc("write_participant_sensitive", { p_participant_id: participant.id,
    p_passport_no: "DEMO-NOT-VALID", p_passport_country: "VN", p_passport_expiry: "2030-01-01",
    p_medical_note: "가상 건강정보: 데모 열람·수정·파기 테스트용", p_mobility_need: "데모 이동 지원 요청" });
  if (writeError) throw writeError;
}
// Read once through the real permission boundary to create a sensitive-access audit entry.
const { error: readError } = await pco.rpc("read_participant_sensitive", { p_participant_id: tables.participant[0].id });
if (readError) throw readError;
await pco.auth.signOut();
console.log("데모 생성 완료. 기존 계정·데모 수정 내용은 유지했습니다.");
console.table(emails);
if (newRoles.length) console.log(`새 계정(${newRoles.join(", ")}) 비밀번호: ${password}`);
console.log("기존 계정 비밀번호는 변경하지 않았습니다. 대리인은 /portal-login에서 이메일 OTP로 로그인합니다.");
console.log(`PCO 행사: /console/events/${demoId("event:active")}`);
