import assert from "node:assert/strict";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { demoId } from "./demo-data.mjs";

config({ path: ".env.local", quiet: true });
assert(process.argv.slice(2).every((arg) => arg === "--apply"), "Use --apply to revoke the extra demo assignments.");
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const primaryId = demoId("delegation:VN");
const obsoleteIds = ["JP", "SG", "FR"].map((country) => demoId(`delegation:${country}`));
const primary = await client.from("delegation_proxy").select("user_id").eq("delegation_id", primaryId).eq("status", "ACTIVE").single();
if (primary.error) throw primary.error;
const userId = primary.data.user_id;
const account = await client.auth.admin.getUserById(userId);
if (account.error) throw account.error;
assert.equal(account.data.user.email, "choby.pm+demo-proxy@gmail.com");
assert.equal(account.data.user.app_metadata.demo_seed, "mice-invi-v1");
const assignments = await client.from("delegation_proxy").select("delegation_id, status, tenant_id").eq("user_id", userId);
if (assignments.error) throw assignments.error;
assert(assignments.data.every((row) => row.tenant_id === demoId("tenant") && [primaryId, ...obsoleteIds].includes(row.delegation_id)), "Unexpected assignment: no changes made.");
console.log(`Extra active assignments: ${assignments.data.filter((row) => obsoleteIds.includes(row.delegation_id) && row.status === "ACTIVE").length}`);
if (!process.argv.includes("--apply")) {
  console.log("Preview only. No data changed.");
} else {
  const result = await client.from("delegation_proxy").update({ status: "REMOVED" }).eq("user_id", userId).in("delegation_id", obsoleteIds).eq("status", "ACTIVE");
  if (result.error) throw result.error;
  const active = await client.from("delegation_proxy").select("delegation_id").eq("user_id", userId).eq("status", "ACTIVE");
  if (active.error) throw active.error;
  assert.deepEqual(active.data.map((row) => row.delegation_id), [primaryId]);
  console.log("Only Vietnam remains active. Delegations, participants and service data preserved.");
}
