import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/0031_service_access.sql", "utf8");
describe("서비스 권한 경계", () => {
  it("업체 대표단 범위를 실제 배정 서비스로 제한", () => {
    expect(sql).toContain("service_item si");
    expect(sql).toContain("si.delegation_id = target_delegation_id");
  });
  it("확정·소속 변경은 DB에서 검사", () => {
    expect(sql).toContain("before insert or update on service_item");
    expect(sql).toContain("new.confirmation_note is distinct from old.confirmation_note");
    expect(sql).toContain("new.tenant_id is distinct from old.tenant_id");
  });
  it("암호화 키는 외부 RPC에서 호출할 수 없음", () => {
    expect(sql).toContain("revoke execute on function get_event_key(uuid) from public, anon, authenticated");
  });
});
