"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/env";
import { resolveAuthProfile } from "@/lib/auth/context";
import { organizationRequestSchema } from "@/lib/organization-requests/schemas";
import type { OrganizationRequestActionState } from "@/lib/organization-requests/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function normalizeWebsite(value: string | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export async function submitOrganizationRequestAction(
  _previousState: OrganizationRequestActionState,
  formData: FormData
): Promise<OrganizationRequestActionState> {
  if (!hasSupabaseAdminConfig()) {
    return {
      success: false,
      message: "Organization requests are not configured on this deployment.",
    };
  }

  const resolution = await resolveAuthProfile();

  if (resolution.state !== "active" || !resolution.context.isDemo) {
    return {
      success: false,
      message: "Start the public demo before requesting a Contento organization.",
    };
  }

  const parsed = organizationRequestSchema.safeParse({
    organizationName: formString(formData, "organizationName"),
    agencyName: formString(formData, "agencyName"),
    ownerFullName: formString(formData, "ownerFullName"),
    businessEmail: formString(formData, "businessEmail"),
    phone: formString(formData, "phone"),
    country: formString(formData, "country"),
    city: formString(formData, "city"),
    agencySize: formString(formData, "agencySize"),
    numberOfEmployees: formString(formData, "numberOfEmployees"),
    expectedUsers: formString(formData, "expectedUsers"),
    expectedClients: formString(formData, "expectedClients"),
    website: formString(formData, "website"),
    industry: formString(formData, "industry"),
    preferredContract: formString(formData, "preferredContract"),
    needsEnterprisePricing: formData.get("needsEnterprisePricing") === "yes",
    additionalNotes: formString(formData, "additionalNotes"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check your organization request details.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("organization_requests")
    .insert({
      status: "pending",
      organization_name: parsed.data.organizationName,
      agency_name: parsed.data.agencyName,
      owner_full_name: parsed.data.ownerFullName,
      business_email: parsed.data.businessEmail,
      phone: parsed.data.phone,
      country: parsed.data.country,
      city: parsed.data.city,
      agency_size: parsed.data.agencySize,
      number_of_employees: parsed.data.numberOfEmployees,
      expected_users: parsed.data.expectedUsers,
      expected_clients: parsed.data.expectedClients,
      website: normalizeWebsite(parsed.data.website),
      industry: parsed.data.industry,
      preferred_contract: parsed.data.preferredContract,
      needs_enterprise_pricing: parsed.data.needsEnterprisePricing,
      additional_notes: parsed.data.additionalNotes ?? "",
      source_demo_session_id: resolution.context.demoSessionId,
      source_user_id: resolution.context.userId,
      activation_email_placeholder: {
        status: "not_prepared",
        online_purchase: "coming_soon",
      },
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("organization request submit failed", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });

    return {
      success: false,
      message: "Your organization request could not be submitted. Please try again shortly.",
    };
  }

  return {
    success: true,
    requestId: data.id,
    message: "Request submitted. A Contento Super Admin can now review it.",
  };
}
