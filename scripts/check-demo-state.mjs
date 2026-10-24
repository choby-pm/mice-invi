import assert from "node:assert/strict";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { demoId, SERVICE_TYPES } from "./demo-data.mjs";

config({ path: ".env.local", quiet: true });
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const counts = {};
for (const [table, minimum] of Object.entries({ event: 3, delegation: 102, participant: 197, service_item: 511 })) {
  const result = await client.from(table).select("id", { count: "exact", head: true }).eq("tenant_id", demoId("tenant"));
  if (result.error) throw new Error(`${table}: verification failed`);
  assert(result.count >= minimum, `${table}: original demo records missing`);
  counts[table] = result.count;
}
const assignments = await client.from("delegation_proxy").select("user_id").eq("delegation_id", demoId("delegation:VN")).eq("status", "ACTIVE").single();
if (assignments.error) throw new Error("Vietnam demo assignment missing");
const active = await client.from("delegation_proxy").select("delegation_id").eq("user_id", assignments.data.user_id).eq("status", "ACTIVE");
if (active.error) throw new Error("Assignment verification failed");
assert.deepEqual(active.data.map((row) => row.delegation_id), [demoId("delegation:VN")]);
// 업체마다 전용 데모 계정이 하나씩, 그 계정은 자기 업체에만 소속되어야 합니다.
for (const type of SERVICE_TYPES) {
  const vendor = await client.from("vendor_member").select("user_id").eq("vendor_id", demoId(`vendor:${type}`)).eq("status", "ACTIVE").single();
  if (vendor.error) throw new Error(`${type} demo assignment missing`);
  const vendors = await client.from("vendor_member").select("vendor_id").eq("user_id", vendor.data.user_id).eq("status", "ACTIVE");
  if (vendors.error) throw new Error(`${type} scope verification failed`);
  assert.deepEqual(vendors.data.map((row) => row.vendor_id), [demoId(`vendor:${type}`)]);
}
console.log(JSON.stringify({ counts, proxyCountries: 1, vendorCompanies: SERVICE_TYPES.length, dataChanged: false }));
