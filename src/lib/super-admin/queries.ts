import { requireSuperiorAdminContext } from "@/lib/auth/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/env";
import type { Database, Json } from "@/types/database";

export type PlatformOrganization = Database["public"]["Tables"]["companies"]["Row"] & {
  ownerEmail: string | null;
  userCount: number;
  teamCount: number;
  activityCount: number;
};

export type PlatformActivityLog = Database["public"]["Tables"]["platform_activity_logs"]["Row"] & {
  adminEmail: string | null;
};

export type PlatformOrganizationDetail = PlatformOrganization & {
  admins: Array<{
    id: string;
    email: string;
    name: string;
    status: Database["public"]["Enums"]["user_status"];
    createdAt: string;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    userEmail: string | null;
    createdAt: string;
    metadata: Json;
  }>;
  settings: Json;
  hardDeletePreview: OrganizationHardDeletePreview;
};

export type OrganizationHardDeletePreview = {
  users: number;
  clients: number;
  teams: number;
  tasks: number;
  ideas: number;
  content: number;
  reports: number;
  calendarItems: number;
  notifications: number;
  chatMessages: number;
  files: number;
};

function requireAdminConfig() {
  if (!hasSupabaseAdminConfig()) {
    throw new Error("Supabase service role is required for platform administration.");
  }
}

async function getTableCount(
  companyId: string,
  table:
    | "users"
    | "teams"
    | "activity_logs"
    | "clients"
    | "tasks"
    | "ideas"
    | "content_items"
    | "reports"
    | "calendar_events"
    | "day_off_requests"
    | "notifications"
    | "chat_messages"
    | "attachments"
) {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

async function getOrganizationHardDeletePreview(companyId: string): Promise<OrganizationHardDeletePreview> {
  const [
    users,
    clients,
    teams,
    tasks,
    ideas,
    content,
    reports,
    calendarEvents,
    dayOffRequests,
    notifications,
    chatMessages,
    attachments,
  ] = await Promise.all([
    getTableCount(companyId, "users"),
    getTableCount(companyId, "clients"),
    getTableCount(companyId, "teams"),
    getTableCount(companyId, "tasks"),
    getTableCount(companyId, "ideas"),
    getTableCount(companyId, "content_items"),
    getTableCount(companyId, "reports"),
    getTableCount(companyId, "calendar_events"),
    getTableCount(companyId, "day_off_requests"),
    getTableCount(companyId, "notifications"),
    getTableCount(companyId, "chat_messages"),
    getTableCount(companyId, "attachments"),
  ]);

  return {
    users,
    clients,
    teams,
    tasks,
    ideas,
    content,
    reports,
    calendarItems: calendarEvents + dayOffRequests,
    notifications,
    chatMessages,
    files: attachments,
  };
}

async function enrichOrganizations(
  organizations: Database["public"]["Tables"]["companies"]["Row"][]
): Promise<PlatformOrganization[]> {
  const supabase = createSupabaseAdminClient();

  return Promise.all(
    organizations.map(async (organization) => {
      const [{ data: owner }, userCount, teamCount, activityCount] = await Promise.all([
        organization.owner_user_id
          ? supabase.from("users").select("email").eq("id", organization.owner_user_id).maybeSingle()
          : Promise.resolve({ data: null }),
        getTableCount(organization.id, "users"),
        getTableCount(organization.id, "teams"),
        getTableCount(organization.id, "activity_logs"),
      ]);

      return {
        ...organization,
        ownerEmail: owner?.email ?? null,
        userCount,
        teamCount,
        activityCount,
      };
    })
  );
}

export async function getPlatformOrganizations() {
  await requireSuperiorAdminContext();
  requireAdminConfig();

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, slug, logo_url, owner_user_id, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load organizations.");
  }

  return enrichOrganizations((data as Database["public"]["Tables"]["companies"]["Row"][] | null) ?? []);
}

export async function getPlatformOverview() {
  const organizations = await getPlatformOrganizations();
  const supabase = createSupabaseAdminClient();

  const { data: activity } = await supabase
    .from("platform_activity_logs")
    .select("id, platform_admin_id, action, entity_type, entity_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  const adminIds = Array.from(
    new Set(((activity as Database["public"]["Tables"]["platform_activity_logs"]["Row"][] | null) ?? [])
      .map((item) => item.platform_admin_id)
      .filter(Boolean) as string[])
  );
  const { data: admins } = adminIds.length
    ? await supabase.from("platform_admins").select("id, email").in("id", adminIds)
    : { data: [] };
  const adminById = new Map(((admins as Array<{ id: string; email: string }> | null) ?? []).map((admin) => [admin.id, admin.email]));

  return {
    organizations,
    totals: {
      organizations: organizations.length,
      active: organizations.filter((organization) => organization.status === "active").length,
      disabled: organizations.filter((organization) => organization.status === "disabled" || organization.status === "suspended").length,
      deleted: organizations.filter((organization) => organization.status === "deleted" || organization.status === "archived").length,
      users: organizations.reduce((sum, organization) => sum + organization.userCount, 0),
      teams: organizations.reduce((sum, organization) => sum + organization.teamCount, 0),
    },
    activity: ((activity as Database["public"]["Tables"]["platform_activity_logs"]["Row"][] | null) ?? []).map((item) => ({
      ...item,
      adminEmail: item.platform_admin_id ? adminById.get(item.platform_admin_id) ?? null : null,
    })),
  };
}

export async function getPlatformOrganizationDetail(organizationId: string) {
  await requireSuperiorAdminContext();
  requireAdminConfig();

  const supabase = createSupabaseAdminClient();
  const { data: organization, error } = await supabase
    .from("companies")
    .select("id, name, slug, logo_url, owner_user_id, status, created_at, updated_at")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !organization) {
    throw new Error("Organization not found.");
  }

  const [enriched] = await enrichOrganizations([organization as Database["public"]["Tables"]["companies"]["Row"]]);
  const [{ data: roles }, { data: users }, { data: recentActivity }, { data: settings }, hardDeletePreview] = await Promise.all([
    supabase.from("roles").select("id, name").eq("company_id", organizationId),
    supabase
      .from("users")
      .select("id, email, first_name, last_name, status, role_id, created_at")
      .eq("company_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_logs")
      .select("id, user_id, action, metadata, created_at")
      .eq("company_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("company_settings").select("settings_json").eq("company_id", organizationId).maybeSingle(),
    getOrganizationHardDeletePreview(organizationId),
  ]);

  const roleById = new Map(((roles as Array<{ id: string; name: string }> | null) ?? []).map((role) => [role.id, role.name]));
  const userRows = (users as Array<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    status: Database["public"]["Enums"]["user_status"];
    role_id: string | null;
    created_at: string;
  }> | null) ?? [];
  const userById = new Map(userRows.map((user) => [user.id, user]));

  return {
    ...enriched,
    admins: userRows
      .filter((user) => roleById.get(user.role_id ?? "") === "Admin")
      .map((user) => ({
        id: user.id,
        email: user.email,
        name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email,
        status: user.status,
        createdAt: user.created_at,
      })),
    recentActivity: ((recentActivity as Array<{
      id: string;
      user_id: string | null;
      action: string;
      metadata: Json;
      created_at: string;
    }> | null) ?? []).map((item) => ({
      id: item.id,
      action: item.action,
      userEmail: item.user_id ? userById.get(item.user_id)?.email ?? null : null,
      createdAt: item.created_at,
      metadata: item.metadata,
    })),
    settings: settings?.settings_json ?? {},
    hardDeletePreview,
  };
}
