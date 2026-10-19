import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { buildDemoData, demoId, SERVICE_TYPES } from "./demo-data.mjs";

const users = Object.fromEntries(["pco", "manager", "field", "vendor", "proxy"].map((role) => [role, demoId(`user:${role}`)]));
const data = buildDemoData(users);

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

test("each delegation has three participant types and five assigned service types", () => {
  assert.equal(data.delegation.length, 6);
  assert.equal(data.participant.length, 18);
  assert.deepEqual(new Set(data.tenant_member.map((row) => row.role)), new Set(["PCO_ADMIN", "PCO_MANAGER", "PCO_FIELD"]));
  for (const delegation of data.delegation) {
    const participants = data.participant.filter((p) => p.delegation_id === delegation.id);
    assert.deepEqual(participants.map((p) => p.participant_type), ["VIP", "COMPANION", "STAFF"]);
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
    assert.equal(adjustments.length, 3);
    assert.ok(adjustments.every((a) => (issue.status === "CLOSED") === (a.status === "DONE")));
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
