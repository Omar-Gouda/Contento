"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/env";
import { resolveAuthProfile } from "@/lib/auth/context";
import { normalizeBillingEmail } from "@/lib/billing/constants";
import {
  calculateOrganizationRequestAmount,
  isOrganizationRequestDurationYears,
  isOrganizationRequestPlanCode,
} from "@/lib/organization-requests/pricing";
import { organizationRequestSchema } from "@/lib/organization-requests/schemas";
import type { OrganizationRequestActionState } from "@/lib/organization-requests/state";

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

const pendingRequestStatuses = ["pending", "ready_for_onboarding"] as const;

function readSupabaseError(error: unknown): SupabaseLikeError {
  if (!error || typeof error !== "object") {
    return {};
  }

  const record = error as Record<string, unknown>;

  return {
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
    details: typeof record.details === "string" ? record.details : undefined,
    hint: typeof record.hint === "string" ? record.hint : undefined,
  };
}

function logOrganizationRequestFailure(step: string, error?: unknown) {
  const supabaseError = readSupabaseError(error);

  console.error("organization request submission failed", {
    step,
    code: supabaseError.code,
    message: supabaseError.message,
    details: supabaseError.details,
    hint: supabaseError.hint,
  });
}

function organizationRequestFailureMessage(step: string) {
  if (process.env.NODE_ENV === "development") {
    return `Organization request failed at: ${step}`;
  }

  return "Your organization request could not be submitted. Please try again shortly.";
}

function formString(formData: FormData, key: string, ...aliases: string[]) {
  let firstValue = "";

  for (const candidate of [key, ...aliases]) {
    const value = formData.get(candidate);

    if (typeof value !== "string") {
      continue;
    }

    firstValue ||= value;

    if (value.trim()) {
      return value;
    }
  }

  return firstValue;
}

function formBoolean(formData: FormData, key: string, ...aliases: string[]) {
  return [key, ...aliases].some((candidate) => {
    const value = formData.get(candidate);

    if (typeof value !== "string") {
      return false;
    }

    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  });
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
    organizationName: formString(formData, "organizationName", "organization_name"),
    agencyName: formString(formData, "agencyName", "agency_name"),
    ownerFullName: formString(formData, "ownerFullName", "owner_full_name"),
    businessEmail: formString(formData, "businessEmail", "business_email"),
    phone: formString(formData, "phone"),
    country: formString(formData, "country"),
    city: formString(formData, "city"),
    agencySize: formString(formData, "agencySize", "agency_size"),
    numberOfEmployees: formString(formData, "numberOfEmployees", "number_of_employees"),
    expectedUsers: formString(formData, "expectedUsers", "expected_users"),
    expectedClients: formString(formData, "expectedClients", "expected_clients"),
    website: formString(formData, "website"),
    industry: formString(formData, "industry"),
    preferredContract: formString(formData, "preferredContract", "preferred_contract"),
    needsEnterprisePricing: formBoolean(formData, "needsEnterprisePricing", "needs_enterprise_pricing"),
    planCode: formString(formData, "planCode", "plan_code", "selected_plan_code"),
    durationYears: formString(formData, "durationYears", "duration_years", "selected_duration_years"),
    calculatedAmountEgp: formString(formData, "calculatedAmountEgp", "calculated_amount_egp"),
    additionalNotes: formString(formData, "additionalNotes", "additional_notes"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check your organization request details.",
    };
  }

  if (!isOrganizationRequestPlanCode(parsed.data.planCode) || !isOrganizationRequestDurationYears(parsed.data.durationYears)) {
    return {
      success: false,
      message: "Choose a valid Contento plan and duration.",
    };
  }

  const calculatedAmountEgp = calculateOrganizationRequestAmount(
    parsed.data.planCode,
    parsed.data.durationYears
  );
  const admin = createSupabaseAdminClient();
  const normalizedEmail = normalizeBillingEmail(parsed.data.businessEmail);
  const { data: blacklistedEmail, error: blacklistError } = await admin
    .from("trial_blacklist")
    .select("id")
    .eq("normalized_email", normalizedEmail)
    .maybeSingle();

  if (blacklistError) {
    const step = "trial_blacklist_check";
    logOrganizationRequestFailure(step, blacklistError);

    return {
      success: false,
      message: organizationRequestFailureMessage(step),
    };
  }

  if (blacklistedEmail?.id) {
    return {
      success: false,
      message: "This email is not eligible for another free trial.",
    };
  }

  if (resolution.context.demoSessionId) {
    const { data: existingSessionRequest, error: existingSessionError } = await admin
      .from("organization_requests")
      .select("id")
      .eq("source_demo_session_id", resolution.context.demoSessionId)
      .in("status", [...pendingRequestStatuses])
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSessionError) {
      const step = "duplicate_session_check";
      logOrganizationRequestFailure(step, existingSessionError);

      return {
        success: false,
        message: organizationRequestFailureMessage(step),
      };
    }

    if (existingSessionRequest?.id) {
      return {
        success: false,
        message: "You already have a pending organization request.",
      };
    }
  }

  const { data: existingEmailRequest, error: existingEmailError } = await admin
    .from("organization_requests")
    .select("id")
    .eq("business_email", parsed.data.businessEmail)
    .in("status", [...pendingRequestStatuses])
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingEmailError) {
    const step = "duplicate_email_check";
    logOrganizationRequestFailure(step, existingEmailError);

    return {
      success: false,
      message: organizationRequestFailureMessage(step),
    };
  }

  if (existingEmailRequest?.id) {
    return {
      success: false,
      message: "You already have a pending organization request.",
    };
  }

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
      needs_enterprise_pricing: parsed.data.planCode === "enterprise" || parsed.data.needsEnterprisePricing,
      plan_code: parsed.data.planCode,
      duration_years: parsed.data.durationYears,
      calculated_amount_egp: calculatedAmountEgp,
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
    const step = "organization_request_insert";
    logOrganizationRequestFailure(step, error);

    return {
      success: false,
      message: organizationRequestFailureMessage(step),
    };
  }

  const { error: supportItemError } = await admin.from("platform_support_items").insert({
    type: "demo_request",
    title: `Organization request: ${parsed.data.organizationName}`,
    description: "Public demo user requested a real Contento organization.",
    requester_email: parsed.data.businessEmail,
    source_entity_type: "organization_request",
    source_entity_id: data.id,
    status: "open",
    priority: parsed.data.planCode === "enterprise" ? "high" : "normal",
    metadata: {
      plan_code: parsed.data.planCode,
      duration_years: parsed.data.durationYears,
      calculated_amount_egp: calculatedAmountEgp,
      expected_users: parsed.data.expectedUsers,
      expected_clients: parsed.data.expectedClients,
    },
  });

  if (supportItemError) {
    logOrganizationRequestFailure("support_item_insert", supportItemError);
  }

  return {
    success: true,
    requestId: data.id,
    message: "Request submitted. A Contento Super Admin can now review it.",
  };
}
