import assert from "node:assert/strict";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { demoId, SERVICE_TYPES } from "./demo-data.mjs";
config({ path: ".env.local", quiet: true });
assert(process.argv.slice(2).every((arg) => arg === "--apply"));
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const primaryId = demoId("vendor:FLIGHT"), others = SERVICE_TYPES.filter((type) => type !== "FLIGHT").map((type) => demoId(`vendor:${type}`));
const primary = await client.from("vendor_member").select("user_id").eq("vendor_id", primaryId).eq("status", "ACTIVE").single();
if (primary.error) throw new Error("Aviation demo membership missing");
const userId = primary.data.user_id;
const account = await client.auth.admin.getUserById(userId);
if (account.error) throw new Error("Demo identity verification failed");
assert.equal(account.data.user.email, "choby.pm+demo-vendor@gmail.com");
assert.equal(account.data.user.app_metadata.demo_seed, "mice-invi-v1");
const members = await client.from("vendor_member").select("vendor_id,status").eq("user_id", userId);
if (members.error) throw new Error("Demo scope verification failed");
assert(members.data.every((row) => [primaryId, ...others].includes(row.vendor_id)), "Unexpected vendor membership: no changes made");
if (process.argv.includes("--apply")) {
  const result = await client.from("vendor_member").update({ status: "REMOVED" }).eq("user_id", userId).in("vendor_id", others).eq("status", "ACTIVE");
  if (result.error) throw new Error("Demo membership restriction failed");
}
const active = await client.from("vendor_member").select("vendor_id").eq("user_id", userId).eq("status", "ACTIVE");
if (active.error) throw new Error("Result verification failed");
if (process.argv.includes("--apply")) assert.deepEqual(active.data.map((row) => row.vendor_id), [primaryId]);
console.log(JSON.stringify({ activeVendorMemberships: active.data.length, serviceDataChanged: false }));
