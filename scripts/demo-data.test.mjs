import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { buildDemoData, demoId, SERVICE_TYPES, DEMO_USER_ROLES, DEMO_VENDOR_USERS } from "./demo-data.mjs";

const users = Object.fromEntries(DEMO_USER_ROLES.map((role) => [role, demoId(`user:${role}`)]));
const data = buildDemoData(users);

test("proxy demo has exactly one active country assignment", () => {
  assert.deepEqual(data.delegation_proxy.map((row) => ({ delegation_id: row.delegation_id, status: row.status })), [{ delegation_id: demoId("delegation:VN"), status: "ACTIVE" }]);
});
test("each vendor demo account belongs to exactly one company", () => {
  assert.deepEqual(data.vendor_member.map((row) => ({ vendor_id: row.vendor_id, user_id: row.user_id, status: row.status })),
    SERVICE_TYPES.map((type) => ({ vendor_id: demoId(`vendor:${type}`), user_id: users[DEMO_VENDOR_USERS[type]], status: "ACTIVE" })));
  assert.equal(new Set(data.vendor_member.map((row) => row.user_id)).size, SERVICE_TYPES.length);
  assert.equal(data.vendor_member.find((row) => row.vendor_id === demoId("vendor:FLIGHT")).id, demoId("vendor_member:FLIGHT"));
});

test("stable unique IDs, all relationships stay inside the demo tenant", () => {
  assert.deepEqual(buildDemoData(users), data);
  const ids = new Set(Object.values(data).flat().map((row) => row.id));
  assert.equal(ids.size, Object.values(data).flat().length);
  const externalUsers = new Set(Object.values(users));
  for (const rows of Object.values(data)) for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (value === null) continue;
      if (key.endsWith("_id")) assert.ok(ids.has(value) || externalUsers.has(value), `${key}=${value}`);
      if (key.endsWith("_ids")) for (const id of value) assert.ok(ids.has(id), `${key}=${id}`);
    }
    if (row.tenant_id) assert.equal(row.tenant_id, demoId("tenant"));
  }
});

test("large event: 60 countries, 100 VIPs and companions, five assigned service types each", () => {
  assert.equal(data.delegation.length, 60);
  assert.equal(new Set(data.delegation.map((d) => d.country)).size, 60);
  assert.equal(data.participant.filter((p) => p.participant_type !== "STAFF").length, 100);
  assert.deepEqual(new Set(data.tenant_member.map((row) => row.role)), new Set(["PCO_ADMIN", "PCO_MANAGER", "PCO_FIELD"]));
  for (const delegation of data.delegation) {
    const participants = data.participant.filter((p) => p.delegation_id === delegation.id);
    assert.equal(participants.filter((p) => p.participant_type === "VIP").length, 1);
    const services = data.service_item.filter((s) => s.delegation_id === delegation.id);
    assert.deepEqual(new Set(services.map((s) => s.service_type)), new Set(SERVICE_TYPES));
    assert.ok(services.every((s) => data.event_vendor.some((v) => v.id === s.event_vendor_id && v.service_types.includes(s.service_type))));
  }
});

test("trigger-created service IDs propagate to requests, confirmations and issues", () => {
  const mapped = demoId("existing-flight");
  const rows = buildDemoData(users, { "VN:FLIGHT": mapped });
  assert.equal(rows.flight_request[0].service_item_id, mapped);
  assert.equal(rows.flight_segment[0].service_item_id, mapped);
  assert.equal(rows.change_issue[0].origin_service_id, mapped);
});

test("every stage of the service flow appears and details follow service status", () => {
  for (const status of ["DRAFT", "REQUESTED", "IN_PROGRESS", "CONFIRMED", "NOTIFIED", "CHANGING", "CANCEL_REQ", "NOT_APPLICABLE"])
    assert.ok(data.service_item.some((s) => s.status === status), status);
  for (const invite of ["READY", "SENT", "BOUNCED", "OPENED", "IN_PROGRESS", "SUBMITTED", "CONFIRMED", "DECLINED"])
    assert.ok(data.delegation.some((d) => d.invite_status === invite), invite);
  const statusOf = (id) => data.service_item.find((s) => s.id === id).status;
  for (const table of ["flight_request", "lodging_request", "transfer_request", "airport_request", "dietary_requirement"])
    assert.ok(data[table].every((row) => !["DRAFT", "NOT_APPLICABLE"].includes(statusOf(row.service_item_id))), table);
  assert.ok(data.change_issue.length >= 13);
  assert.equal(new Set(data.change_issue.map((i) => i.issue_no)).size, data.change_issue.length);
});

test("demo covers request, fulfillment, consent, schedules and actionable issues", () => {
  assert.deepEqual(new Set(data.event.map((e) => e.status)), new Set(["ACTIVE", "PREPARING", "CLOSED"]));
  assert.equal(data.consent_item.length, 6);
  assert.ok(data.consent_record.some((row) => row.status === "NEEDS_REAGREEMENT"));
  for (const table of ["flight_request", "flight_segment", "lodging_request", "room_assignment", "transfer_request",
    "vehicle_dispatch", "airport_request", "airport_assignment", "dietary_requirement"]) assert.ok(data[table].length, table);
  assert.deepEqual(new Set(data.program.map((row) => row.visibility)), new Set(["PUBLIC", "STAKEHOLDER", "PRIVATE"]));
  const self = data.program.find((p) => p.program_type === "SELF_SCHEDULED");
  const attendance = data.program_attendance.filter((a) => a.program_id === self.id);
  assert.ok(attendance.every((a) => data.participant.find((p) => p.id === a.participant_id).delegation_id === self.organizer_delegation_id));
  assert.ok(data.transfer_request.some((t) => t.source_program_id === self.id));
  for (const issue of data.change_issue) {
    const adjustments = data.adjustment_item.filter((a) => a.issue_id === issue.id);
    assert.ok(adjustments.length >= 1);
    assert.equal(issue.status === "CLOSED", adjustments.every((a) => a.status === "DONE"));
    assert.ok(adjustments.every((a) => data.service_item.find((s) => s.id === a.service_item_id).delegation_id === issue.delegation_id));
  }
});

test("fixture columns exist in the repository migrations", () => {
  const directory = new URL("../supabase/migrations/", import.meta.url);
  const sql = readdirSync(directory).sort().map((file) => readFileSync(new URL(file, directory), "utf8")).join("\n");
  const columns = {};
  for (const match of sql.matchAll(/create table if not exists (\w+) \(([\s\S]*?)\n\);/g)) {
    columns[match[1]] = new Set([...match[2].matchAll(/^\s{2}(\w+)\s+(?:uuid|text|int|boolean|jsonb|numeric|date|timestamptz|bytea)\b/gm)].map((field) => field[1]));
  }
  for (const match of sql.matchAll(/alter table (\w+) add column if not exists (\w+)/g)) columns[match[1]]?.add(match[2]);
  for (const [table, rows] of Object.entries(data)) {
    assert.ok(columns[table], table);
    for (const row of rows) for (const field of Object.keys(row)) assert.ok(columns[table].has(field), `${table}.${field}`);
  }
});
