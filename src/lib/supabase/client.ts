"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseRuntimeConfig } from "@/lib/env";
import type { Database } from "@/types/database";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabaseRuntimeConfig();

  return createBrowserClient<Database>(url, anonKey);
}
