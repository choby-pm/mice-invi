import assert from "node:assert/strict";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { demoId } from "./demo-data.mjs";

config({ path: ".env.local", quiet: true });
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const counts = {};
for (const [table, minimum] of Object.entries({ event: 3, delegation: 6, participant: 18, service_item: 31 })) {
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
const vendor = await client.from("vendor_member").select("user_id").eq("vendor_id", demoId("vendor:FLIGHT")).eq("status", "ACTIVE").single();
if (vendor.error) throw new Error("Aviation demo assignment missing");
const vendors = await client.from("vendor_member").select("vendor_id").eq("user_id", vendor.data.user_id).eq("status", "ACTIVE");
if (vendors.error) throw new Error("Aviation scope verification failed");
assert.deepEqual(vendors.data.map((row) => row.vendor_id), [demoId("vendor:FLIGHT")]);
console.log(JSON.stringify({ counts, proxyCountries: 1, vendorCompanies: 1, dataChanged: false }));
