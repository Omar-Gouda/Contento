import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";
import type { Json, Database } from "@/types/database";
import { getRoleDisplayName } from "@/types/roles";
import { getCurrentUserWorkHours, type CurrentWorkHours } from "@/lib/work-hours/queries";

export type CompanySettingsData = {
  company: Database["public"]["Tables"]["companies"]["Row"];
  settings: Json;
  companyLogoSignedUrl: string | null;
};

export type NotificationPreferences = {
  sound: boolean;
  toast: boolean;
  desktop: boolean;
};

export type ProfileCompletionItem = {
  label: string;
  complete: boolean;
};

export type ProfileData = Database["public"]["Tables"]["users"]["Row"] & {
  roleName: string;
  teamName: string | null;
  teamNames: string[];
  companyName: string;
  avatarSignedUrl: string | null;
  assignedClients: Array<{
    clientId: string;
    clientName: string;
    assignmentRole: Database["public"]["Tables"]["client_assignments"]["Row"]["assignment_role"];
  }>;
  recentActivity: Array<Pick<
    Database["public"]["Tables"]["activity_logs"]["Row"],
    "id" | "action" | "entity_type" | "entity_id" | "created_at"
  >>;
  workHours: CurrentWorkHours | null;
  notificationPreferences: NotificationPreferences;
  completionItems: ProfileCompletionItem[];
  profileCompletionPercent: number;
};

type TeamMembershipRow = {
  team_id: string;
  teams: { name: string } | null;
};

type ClientAssignmentRow = {
  client_id: string;
  assignment_role: Database["public"]["Tables"]["client_assignments"]["Row"]["assignment_role"];
  clients: { name: string } | null;
};

function isObject(value: Json): value is { [key: string]: Json | undefined } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseNotificationPreferences(value: Json | null | undefined): NotificationPreferences {
  const preferences = isObject(value ?? null) ? value as { [key: string]: Json | undefined } : {};

  return {
    sound: typeof preferences.sound === "boolean" ? preferences.sound : true,
    toast: typeof preferences.toast === "boolean" ? preferences.toast : true,
    desktop: typeof preferences.desktop === "boolean" ? preferences.desktop : false,
  };
}

export async function getCompanySettings(context: AuthContext): Promise<CompanySettingsData> {
  const supabase = await createSupabaseServerClient();
  const [{ data: company, error: companyError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, slug, logo_url, owner_user_id, status, created_at, updated_at")
      .eq("id", context.companyId)
      .maybeSingle(),
    supabase
      .from("company_settings")
      .select("settings_json")
      .eq("company_id", context.companyId)
      .maybeSingle(),
  ]);

  if (companyError || settingsError || !company) {
    throw new Error("Unable to load organization settings.");
  }

  let companyLogoSignedUrl: string | null = null;

  if (company.logo_url) {
    if (company.logo_url.startsWith("http://") || company.logo_url.startsWith("https://")) {
      companyLogoSignedUrl = company.logo_url;
    } else {
      const { data: signedLogo } = await supabase.storage
        .from("contento-avatars")
        .createSignedUrl(company.logo_url, 60 * 60);

      companyLogoSignedUrl = signedLogo?.signedUrl ?? null;
    }
  }

  return {
    company: company as Database["public"]["Tables"]["companies"]["Row"],
    settings: settings?.settings_json ?? {},
    companyLogoSignedUrl,
  };
}

export async function getProfileData(context: AuthContext): Promise<ProfileData> {
  const supabase = await createSupabaseServerClient();
  const [
    { data: profile, error },
    { data: teams },
    { data: company },
    { data: assignments },
    { data: recentActivity },
    workHours,
  ] = await Promise.all([
    supabase
      .from("users")
      .select("id, company_id, email, first_name, last_name, phone, job_title, bio, timezone, avatar_url, role_id, status, must_change_password, notification_preferences, recovery_email, recovery_email_verified_at, recovery_email_pending, recovery_email_token_hash, recovery_email_token_expires_at, last_login_at, profile_completed_at, created_at, updated_at")
      .eq("id", context.userId)
      .eq("company_id", context.companyId)
      .maybeSingle(),
    supabase
      .from("team_members")
      .select("team_id, teams(name)")
      .eq("user_id", context.userId),
    supabase
      .from("companies")
      .select("name")
      .eq("id", context.companyId)
      .maybeSingle(),
    supabase
      .from("client_assignments")
      .select("client_id, assignment_role, clients(name)")
      .eq("user_id", context.userId),
    supabase
      .from("activity_logs")
      .select("id, action, entity_type, entity_id, created_at")
      .eq("company_id", context.companyId)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(5),
    getCurrentUserWorkHours(context).catch(() => null),
  ]);

  if (error || !profile) {
    throw new Error("Unable to load profile.");
  }

  const profileRow = profile as Database["public"]["Tables"]["users"]["Row"];
  const teamRows = (teams as TeamMembershipRow[] | null) ?? [];
  const teamNames = teamRows
    .map((membership) => membership.teams?.name)
    .filter((name): name is string => Boolean(name));
  const firstTeam = teamRows[0];
  const assignmentRows = (assignments as ClientAssignmentRow[] | null) ?? [];
  const assignedClients = assignmentRows
    .map((assignment) => assignment.clients?.name ? {
      clientId: assignment.client_id,
      clientName: assignment.clients.name,
      assignmentRole: assignment.assignment_role,
    } : null)
    .filter((assignment): assignment is {
      clientId: string;
      clientName: string;
      assignmentRole: Database["public"]["Tables"]["client_assignments"]["Row"]["assignment_role"];
    } => Boolean(assignment));
  const notificationPreferences = parseNotificationPreferences(profileRow.notification_preferences);

  let avatarSignedUrl: string | null = null;

  if (profileRow.avatar_url) {
    if (profileRow.avatar_url.startsWith("http://") || profileRow.avatar_url.startsWith("https://")) {
      avatarSignedUrl = profileRow.avatar_url;
    } else {
      const { data: signedAvatar } = await supabase.storage
        .from("contento-avatars")
        .createSignedUrl(profileRow.avatar_url, 60 * 60);

      avatarSignedUrl = signedAvatar?.signedUrl ?? null;
    }
  }

  const completionItems: ProfileCompletionItem[] = [
    { label: "Full name", complete: Boolean(profileRow.first_name.trim() && profileRow.last_name.trim()) },
    { label: "Avatar", complete: Boolean(profileRow.avatar_url) },
    { label: "Phone", complete: Boolean(profileRow.phone?.trim()) },
    { label: "Job title", complete: Boolean(profileRow.job_title?.trim()) },
    { label: "Bio", complete: Boolean(profileRow.bio.trim()) },
    { label: "Team", complete: teamNames.length > 0 },
    { label: "Timezone", complete: Boolean(profileRow.timezone) },
    { label: "Notification preferences", complete: Boolean(profileRow.notification_preferences) },
    { label: "Recovery email", complete: Boolean(profileRow.recovery_email?.trim()) },
    { label: "Security", complete: !profileRow.must_change_password },
    { label: "Work hours", complete: Boolean(workHours?.workDay) },
  ];
  const completedItems = completionItems.filter((item) => item.complete).length;

  return {
    ...profileRow,
    roleName: getRoleDisplayName(context.role),
    teamName: firstTeam?.teams?.name ?? null,
    teamNames,
    companyName: (company as { name: string } | null)?.name ?? "Workspace",
    avatarSignedUrl,
    assignedClients,
    recentActivity: (recentActivity as ProfileData["recentActivity"] | null) ?? [],
    workHours,
    notificationPreferences,
    completionItems,
    profileCompletionPercent: Math.round((completedItems / completionItems.length) * 100),
  };
}

export async function getUserNotificationPreferences(context: AuthContext) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("users")
    .select("notification_preferences")
    .eq("id", context.userId)
    .eq("company_id", context.companyId)
    .maybeSingle();

  return parseNotificationPreferences(data?.notification_preferences ?? null);
}

export async function getCompanyBranding(context: AuthContext) {
  try {
    const data = await getCompanySettings(context);
    const settings = data.settings;
    const fallback = {
      companyName: data.company.name,
      logoUrl: data.companyLogoSignedUrl,
      primaryColor: null,
      secondaryColor: null,
      accentColor: null,
    };

    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return fallback;
    }

    const branding = settings.branding;

    if (!branding || typeof branding !== "object" || Array.isArray(branding)) {
      return fallback;
    }

    return {
      companyName: data.company.name,
      logoUrl: data.companyLogoSignedUrl,
      primaryColor: typeof branding.primaryColor === "string" ? branding.primaryColor : null,
      secondaryColor: typeof branding.secondaryColor === "string" ? branding.secondaryColor : null,
      accentColor: typeof branding.accentColor === "string" ? branding.accentColor : null,
    };
  } catch {
    return null;
  }
}
