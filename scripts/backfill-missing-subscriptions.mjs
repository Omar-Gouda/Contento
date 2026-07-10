#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(pathname) {
  if (!existsSync(pathname)) {
    return;
  }

  for (const line of readFileSync(pathname, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...rest] = trimmed.split("=");
    const value = rest.join("=").replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const dryRun = process.argv.includes("--dry-run");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const [{ data: starterPlan, error: planError }, { data: companies, error: companiesError }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
  supabase.from("subscription_plans").select("id").eq("code", "starter").maybeSingle(),
  supabase.from("companies").select("id, name").order("created_at", { ascending: true }),
  supabase.from("organization_subscriptions").select("company_id"),
]);

if (planError || companiesError || subscriptionsError) {
  console.error("Unable to load billing backfill inputs.", {
    plan: planError?.message,
    companies: companiesError?.message,
    subscriptions: subscriptionsError?.message,
  });
  process.exit(1);
}

const subscribedCompanyIds = new Set((subscriptions ?? []).map((subscription) => subscription.company_id));
const missingCompanies = (companies ?? []).filter((company) => !subscribedCompanyIds.has(company.id));

console.log(`Found ${missingCompanies.length} compan${missingCompanies.length === 1 ? "y" : "ies"} without subscriptions.`);

if (dryRun || !missingCompanies.length) {
  if (dryRun) {
    console.log("Dry run only. No subscriptions were created.");
  }
  process.exit(0);
}

const { data: inserted, error: insertError } = await supabase
  .from("organization_subscriptions")
  .insert(missingCompanies.map((company) => ({
    company_id: company.id,
    plan_id: starterPlan?.id ?? null,
    status: "trial_pending",
    trial_started_at: null,
    trial_ends_at: null,
    grace_ends_at: null,
    payment_method: "instapay_manual",
  })))
  .select("company_id");

if (insertError) {
  console.error("Missing subscriptions could not be backfilled.", insertError.message);
  process.exit(1);
}

const insertedRows = inserted ?? [];
const { error: eventError } = await supabase.from("billing_events").insert(
  insertedRows.map((row) => ({
    company_id: row.company_id,
    action: "billing.subscription_backfilled",
    metadata: {
      status: "trial_pending",
      trial_started_at: null,
      trial_ends_at: null,
      grace_ends_at: null,
      plan_code: "starter",
      source: "scripts/backfill-missing-subscriptions.mjs",
    },
  }))
);

if (eventError) {
  console.warn("Subscriptions were backfilled, but billing events could not be logged.", eventError.message);
}

console.log(`Backfilled ${insertedRows.length} missing subscription${insertedRows.length === 1 ? "" : "s"}.`);
