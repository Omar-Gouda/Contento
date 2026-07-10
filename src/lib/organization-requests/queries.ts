import { requireSuperiorAdminContext } from "@/lib/auth/context";
import { hasSupabaseAdminConfig } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type OrganizationRequestStatus =
  Database["public"]["Tables"]["organization_requests"]["Row"]["status"];

export type OrganizationRequestRow =
  Database["public"]["Tables"]["organization_requests"]["Row"];

export const organizationRequestStatuses = [
  "pending",
  "approved",
  "ready_for_onboarding",
  "rejected",
  "archived",
] as const;

export function isOrganizationRequestStatus(value: string | null | undefined): value is (typeof organizationRequestStatuses)[number] {
  return organizationRequestStatuses.some((status) => status === value);
}

export async function getOrganizationRequests(status?: string | null) {
  await requireSuperiorAdminContext();

  if (!hasSupabaseAdminConfig()) {
    throw new Error("Supabase service role is required for organization requests.");
  }

  const supabase = createSupabaseAdminClient();
  const selectedStatus = isOrganizationRequestStatus(status) ? status : null;
  let query = supabase
    .from("organization_requests")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (selectedStatus) {
    query = query.eq("status", selectedStatus);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Unable to load organization requests.");
  }

  return (data as OrganizationRequestRow[] | null) ?? [];
}
