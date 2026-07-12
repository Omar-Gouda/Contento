import "server-only";

import { requireSuperiorAdminContext } from "@/lib/auth/context";
import { formatEgp, type BillingDurationYears } from "@/lib/billing/constants";
import { hasSupabaseAdminConfig } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPlatformOrganizationDetail } from "@/lib/super-admin/queries";
import type { Database, Json } from "@/types/database";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type SubscriptionRow = Database["public"]["Tables"]["organization_subscriptions"]["Row"];
type PlanRow = Database["public"]["Tables"]["subscription_plans"]["Row"];
type ReceiptRow = Database["public"]["Tables"]["payment_receipts"]["Row"];
type BillingEventRow = Database["public"]["Tables"]["billing_events"]["Row"];
type OrganizationRequestRow = Database["public"]["Tables"]["organization_requests"]["Row"];
type PlatformLogRow = Database["public"]["Tables"]["platform_activity_logs"]["Row"];
type TrialBlacklistRow = Database["public"]["Tables"]["trial_blacklist"]["Row"];
type SupportItemRow = Database["public"]["Tables"]["platform_support_items"]["Row"];
type AnnouncementRow = Database["public"]["Tables"]["platform_announcements"]["Row"];
type PlatformEventRow = Database["public"]["Tables"]["platform_events"]["Row"];

export type PlatformDashboardData = Awaited<ReturnType<typeof getPlatformControlCenterDashboard>>;
export type OrganizationControlCenterData = Awaited<ReturnType<typeof getOrganizationControlCenter>>;
export type SupportInboxItem = {
  id: string;
  type: SupportItemRow["type"];
  title: string;
  description: string;
  status: SupportItemRow["status"];
  priority: SupportItemRow["priority"];
  companyName: string | null;
  requesterEmail: string | null;
  createdAt: string;
  internalNote: string;
  sourceHref: string | null;
  sourceLabel: string | null;
  isVirtual: boolean;
};

function requireAdminConfig() {
  if (!hasSupabaseAdminConfig()) {
    throw new Error("Supabase service role is required for platform administration.");
  }
}

async function requirePlatformAdmin() {
  const context = await requireSuperiorAdminContext();
  requireAdminConfig();
  return context;
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

async function getCompaniesById(admin: AdminClient, ids: string[]) {
  if (!ids.length) {
    return new Map<string, Pick<CompanyRow, "id" | "name" | "slug" | "owner_user_id">>();
  }

  const { data } = await admin
    .from("companies")
    .select("id, name, slug, owner_user_id")
    .in("id", ids);

  return new Map(((data as Array<Pick<CompanyRow, "id" | "name" | "slug" | "owner_user_id">> | null) ?? []).map((company) => [company.id, company]));
}

async function getPlatformAdminsById(admin: AdminClient, ids: string[]) {
  if (!ids.length) {
    return new Map<string, { id: string; email: string }>();
  }

  const { data } = await admin
    .from("platform_admins")
    .select("id, email")
    .in("id", ids);

  return new Map(((data as Array<{ id: string; email: string }> | null) ?? []).map((adminRow) => [adminRow.id, adminRow]));
}

async function countRows(
  admin: AdminClient,
  table:
    | "companies"
    | "organization_requests"
    | "payment_receipts"
    | "trial_blacklist"
    | "platform_support_items"
    | "platform_events"
    | "clients"
    | "users"
    | "attachments",
  column = "id"
) {
  const { count } = await admin.from(table).select(column, { count: "exact", head: true });
  return count ?? 0;
}

export async function getPlatformControlCenterDashboard() {
  await requirePlatformAdmin();
  const admin = createSupabaseAdminClient();
  const [
    { data: companies },
    { data: subscriptions },
    { data: plans },
    { count: pendingRequestsCount },
    { count: pendingReceiptsCount },
    { count: blacklistedEmailsCount },
    { data: latestRequests },
    { data: latestReceipts },
    { data: latestBillingEvents },
    { data: latestPlatformLogs },
  ] = await Promise.all([
    admin.from("companies").select("id, name, slug, owner_user_id, status, created_at"),
    admin.from("organization_subscriptions").select("*"),
    admin.from("subscription_plans").select("*"),
    admin.from("organization_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("payment_receipts").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("trial_blacklist").select("id", { count: "exact", head: true }),
    admin.from("organization_requests").select("*").order("submitted_at", { ascending: false }).limit(6),
    admin.from("payment_receipts").select("*").order("created_at", { ascending: false }).limit(6),
    admin.from("billing_events").select("*").order("created_at", { ascending: false }).limit(6),
    admin.from("platform_activity_logs").select("*").order("created_at", { ascending: false }).limit(6),
  ]);

  const companyRows = (companies as Array<Pick<CompanyRow, "id" | "name" | "slug" | "owner_user_id" | "status" | "created_at">> | null) ?? [];
  const subscriptionRows = (subscriptions as SubscriptionRow[] | null) ?? [];
  const planRows = (plans as PlanRow[] | null) ?? [];
  const planById = new Map(planRows.map((plan) => [plan.id, plan]));
  const companyIds = uniqueValues([
    ...((latestReceipts as ReceiptRow[] | null) ?? []).map((receipt) => receipt.company_id),
    ...((latestBillingEvents as BillingEventRow[] | null) ?? []).map((event) => event.company_id),
  ]);
  const companyById = await getCompaniesById(admin, companyIds);
  const platformAdminById = await getPlatformAdminsById(
    admin,
    uniqueValues(((latestPlatformLogs as PlatformLogRow[] | null) ?? []).map((log) => log.platform_admin_id))
  );
  const estimatedActiveAnnualRevenueEgp = subscriptionRows
    .filter((subscription) => subscription.status === "active")
    .reduce((sum, subscription) => sum + (subscription.plan_id ? planById.get(subscription.plan_id)?.yearly_price_egp ?? 0 : 0), 0);

  return {
    metrics: {
      totalOrganizations: companyRows.length,
      activeOrganizations: companyRows.filter((company) => company.status === "active").length,
      trialOrganizations: subscriptionRows.filter((subscription) => subscription.status === "trial_active" || subscription.status === "trial_pending").length,
      gracePeriodOrganizations: subscriptionRows.filter((subscription) => subscription.status === "grace_period").length,
      expiredOrScheduledOrganizations: subscriptionRows.filter((subscription) => subscription.status === "expired" || subscription.status === "scheduled_deletion").length,
      pendingOrganizationRequests: pendingRequestsCount ?? 0,
      pendingPaymentReceipts: pendingReceiptsCount ?? 0,
      estimatedActiveAnnualRevenueEgp,
      blacklistedTrialEmails: blacklistedEmailsCount ?? 0,
    },
    latestRequests: ((latestRequests as OrganizationRequestRow[] | null) ?? []).map((request) => ({
      ...request,
      amountLabel: request.plan_code === "enterprise" ? "Contact Sales" : formatEgp(request.calculated_amount_egp),
    })),
    latestReceipts: ((latestReceipts as ReceiptRow[] | null) ?? []).map((receipt) => ({
      ...receipt,
      companyName: companyById.get(receipt.company_id)?.name ?? "Unknown organization",
      planName: receipt.plan_id ? planById.get(receipt.plan_id)?.name ?? null : null,
    })),
    latestBillingEvents: ((latestBillingEvents as BillingEventRow[] | null) ?? []).map((event) => ({
      ...event,
      companyName: event.company_id ? companyById.get(event.company_id)?.name ?? "Unknown organization" : "Platform",
    })),
    latestPlatformLogs: ((latestPlatformLogs as PlatformLogRow[] | null) ?? []).map((log) => ({
      ...log,
      adminEmail: log.platform_admin_id ? platformAdminById.get(log.platform_admin_id)?.email ?? null : null,
    })),
  };
}

export async function getOrganizationControlCenter(organizationId: string) {
  await requirePlatformAdmin();
  const admin = createSupabaseAdminClient();
  const detail = await getPlatformOrganizationDetail(organizationId);
  const [
    { data: subscription },
    { data: plans },
    { data: receipts },
    { data: billingEvents },
    { data: platformLogs },
    { data: attachmentRows },
    { count: clientCount },
  ] = await Promise.all([
    admin.from("organization_subscriptions").select("*").eq("company_id", organizationId).maybeSingle(),
    admin.from("subscription_plans").select("*").eq("is_active", true).order("yearly_price_egp", { ascending: true, nullsFirst: false }),
    admin.from("payment_receipts").select("*").eq("company_id", organizationId).order("created_at", { ascending: false }).limit(20),
    admin.from("billing_events").select("*").eq("company_id", organizationId).order("created_at", { ascending: false }).limit(20),
    admin.from("platform_activity_logs").select("*").eq("entity_type", "organization").eq("entity_id", organizationId).order("created_at", { ascending: false }).limit(20),
    admin.from("attachments").select("file_size").eq("company_id", organizationId),
    admin.from("clients").select("id", { count: "exact", head: true }).eq("company_id", organizationId),
  ]);
  const subscriptionRow = subscription as SubscriptionRow | null;
  const planRows = (plans as PlanRow[] | null) ?? [];
  const planById = new Map(planRows.map((plan) => [plan.id, plan]));
  const platformAdminById = await getPlatformAdminsById(
    admin,
    uniqueValues(((platformLogs as PlatformLogRow[] | null) ?? []).map((log) => log.platform_admin_id))
  );

  return {
    ...detail,
    subscription: subscriptionRow,
    plan: subscriptionRow?.plan_id ? planById.get(subscriptionRow.plan_id) ?? null : null,
    availablePlans: planRows,
    durationYears: (subscriptionRow?.duration_years ?? 1) as BillingDurationYears,
    clientCount: clientCount ?? 0,
    storageBytes: ((attachmentRows as Array<{ file_size: number | null }> | null) ?? [])
      .reduce((sum, row) => sum + (row.file_size ?? 0), 0),
    paymentReceipts: (receipts as ReceiptRow[] | null) ?? [],
    billingEvents: (billingEvents as BillingEventRow[] | null) ?? [],
    platformLogs: ((platformLogs as PlatformLogRow[] | null) ?? []).map((log) => ({
      ...log,
      adminEmail: log.platform_admin_id ? platformAdminById.get(log.platform_admin_id)?.email ?? null : null,
    })),
  };
}

export async function getTrialBlacklist() {
  await requirePlatformAdmin();
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("trial_blacklist")
    .select("*")
    .order("blacklisted_at", { ascending: false });
  const rows = (data as TrialBlacklistRow[] | null) ?? [];
  const companyById = await getCompaniesById(admin, uniqueValues(rows.map((row) => row.company_id)));
  const platformAdminById = await getPlatformAdminsById(admin, uniqueValues(rows.map((row) => row.created_by)));

  return rows.map((row) => ({
    ...row,
    companyName: row.company_id ? companyById.get(row.company_id)?.name ?? null : null,
    createdByEmail: row.created_by ? platformAdminById.get(row.created_by)?.email ?? null : null,
  }));
}

export async function getSupportInbox() {
  await requirePlatformAdmin();
  const admin = createSupabaseAdminClient();
  const [{ data: supportItems }, { data: requests }, { data: receipts }, { data: events }] = await Promise.all([
    admin.from("platform_support_items").select("*").order("updated_at", { ascending: false }).limit(100),
    admin.from("organization_requests").select("*").in("status", ["pending", "rejected"]).order("submitted_at", { ascending: false }).limit(25),
    admin.from("payment_receipts").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(25),
    admin.from("platform_events").select("*").in("status", ["open"]).order("created_at", { ascending: false }).limit(25),
  ]);
  const receiptRows = (receipts as ReceiptRow[] | null) ?? [];
  const eventRows = (events as PlatformEventRow[] | null) ?? [];
  const supportRows = (supportItems as SupportItemRow[] | null) ?? [];
  const companyById = await getCompaniesById(admin, uniqueValues([
    ...supportRows.map((item) => item.company_id),
    ...receiptRows.map((receipt) => receipt.company_id),
    ...eventRows.map((event) => event.company_id),
  ]));
  const items: SupportInboxItem[] = [
    ...supportRows.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.description,
      status: item.status,
      priority: item.priority,
      companyName: item.company_id ? companyById.get(item.company_id)?.name ?? null : null,
      requesterEmail: item.requester_email,
      createdAt: item.created_at,
      internalNote: item.internal_note,
      sourceHref: item.source_entity_type === "organization_request" ? "/super-admin/organization-requests" : null,
      sourceLabel: item.source_entity_type ? `Open ${item.source_entity_type.replaceAll("_", " ")}` : null,
      isVirtual: false,
    })),
    ...((requests as OrganizationRequestRow[] | null) ?? []).map((request) => ({
      id: `request-${request.id}`,
      type: "organization_request" as const,
      title: `Organization request: ${request.organization_name}`,
      description: request.additional_notes || "Demo workspace conversion request.",
      status: request.status === "pending" ? "open" as const : "in_progress" as const,
      priority: "normal" as const,
      companyName: null,
      requesterEmail: request.business_email,
      createdAt: request.submitted_at,
      internalNote: request.rejection_reason ?? "",
      sourceHref: "/super-admin/organization-requests",
      sourceLabel: "Open requests",
      isVirtual: true,
    })),
    ...receiptRows.map((receipt) => ({
      id: `receipt-${receipt.id}`,
      type: "billing_issue" as const,
      title: `Pending billing receipt: ${formatEgp(receipt.amount_egp)}`,
      description: "Manual InstaPay receipt awaiting Super Admin review.",
      status: "open" as const,
      priority: "high" as const,
      companyName: companyById.get(receipt.company_id)?.name ?? null,
      requesterEmail: null,
      createdAt: receipt.created_at,
      internalNote: "",
      sourceHref: "/super-admin/billing",
      sourceLabel: "Open billing",
      isVirtual: true,
    })),
    ...eventRows.map((event) => ({
      id: `event-${event.id}`,
      type: "other" as const,
      title: event.title,
      description: event.message,
      status: "open" as const,
      priority: event.severity === "critical" ? "urgent" as const : event.severity === "error" ? "high" as const : "normal" as const,
      companyName: event.company_id ? companyById.get(event.company_id)?.name ?? null : null,
      requesterEmail: null,
      createdAt: event.created_at,
      internalNote: event.internal_note,
      sourceHref: "/super-admin/system-health",
      sourceLabel: "Open health",
      isVirtual: true,
    })),
  ];

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getPlatformAnnouncements() {
  await requirePlatformAdmin();
  const admin = createSupabaseAdminClient();
  const [{ data: announcements }, { data: companies }] = await Promise.all([
    admin.from("platform_announcements").select("*").order("created_at", { ascending: false }).limit(100),
    admin.from("companies").select("id, name, slug").order("name"),
  ]);
  const companyById = new Map(((companies as Array<{ id: string; name: string; slug: string }> | null) ?? []).map((company) => [company.id, company]));

  return {
    companies: (companies as Array<{ id: string; name: string; slug: string }> | null) ?? [],
    announcements: ((announcements as AnnouncementRow[] | null) ?? []).map((announcement) => ({
      ...announcement,
      companyName: announcement.target_company_id ? companyById.get(announcement.target_company_id)?.name ?? null : null,
    })),
  };
}

export async function getPlatformAuditLogs(filters: {
  action?: string;
  entityType?: string;
  organizationId?: string;
} = {}) {
  await requirePlatformAdmin();
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("platform_activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.action) {
    query = query.ilike("action", `%${filters.action}%`);
  }

  if (filters.entityType) {
    query = query.eq("entity_type", filters.entityType);
  }

  if (filters.organizationId) {
    query = query.eq("entity_id", filters.organizationId);
  }

  const { data } = await query;
  const rows = (data as PlatformLogRow[] | null) ?? [];
  const [adminById, companyById] = await Promise.all([
    getPlatformAdminsById(admin, uniqueValues(rows.map((row) => row.platform_admin_id))),
    getCompaniesById(admin, uniqueValues(rows.filter((row) => row.entity_type === "organization").map((row) => row.entity_id))),
  ]);

  return rows.map((row) => ({
    ...row,
    adminEmail: row.platform_admin_id ? adminById.get(row.platform_admin_id)?.email ?? null : null,
    organizationName: row.entity_type === "organization" && row.entity_id ? companyById.get(row.entity_id)?.name ?? null : null,
  }));
}

export async function getSystemHealth() {
  await requirePlatformAdmin();
  const admin = createSupabaseAdminClient();
  const [{ data: events }, { data: failedBillingEvents }, { data: scheduledSubscriptions }, { count: openSupport }, organizations, attachments] = await Promise.all([
    admin.from("platform_events").select("*").order("created_at", { ascending: false }).limit(100),
    admin
      .from("billing_events")
      .select("*")
      .or("action.ilike.%failed%,action.ilike.%rejected%,action.ilike.%expired%")
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("organization_subscriptions")
      .select("*")
      .in("status", ["grace_period", "expired", "scheduled_deletion"])
      .order("updated_at", { ascending: false })
      .limit(50),
    admin.from("platform_support_items").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    countRows(admin, "companies"),
    countRows(admin, "attachments"),
  ]);

  return {
    events: (events as PlatformEventRow[] | null) ?? [],
    failedBillingEvents: (failedBillingEvents as BillingEventRow[] | null) ?? [],
    scheduledSubscriptions: (scheduledSubscriptions as SubscriptionRow[] | null) ?? [],
    summary: {
      openSupportItems: openSupport ?? 0,
      organizations,
      trackedFiles: attachments,
      openEvents: ((events as PlatformEventRow[] | null) ?? []).filter((event) => event.status === "open").length,
      criticalEvents: ((events as PlatformEventRow[] | null) ?? []).filter((event) => event.severity === "critical" && event.status === "open").length,
    },
  };
}

export function sanitizeMetadata(metadata: Json) {
  function sanitize(value: Json): Json {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => {
        if (/(password|secret|token|key|receipt_file_path)/i.test(key)) {
          return [key, "[redacted]"];
        }

        return [key, sanitize(nestedValue as Json)];
      })
    );
  }

  return sanitize(metadata);
}
