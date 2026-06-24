import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";
import type { Json, Database } from "@/types/database";

export type CompanySettingsData = {
  company: Database["public"]["Tables"]["companies"]["Row"];
  settings: Json;
};

export type ProfileData = Database["public"]["Tables"]["users"]["Row"] & {
  roleName: string;
  teamName: string | null;
};

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

  return {
    company: company as Database["public"]["Tables"]["companies"]["Row"],
    settings: settings?.settings_json ?? {},
  };
}

export async function getProfileData(context: AuthContext): Promise<ProfileData> {
  const supabase = await createSupabaseServerClient();
  const [{ data: profile, error }, { data: teams }] = await Promise.all([
    supabase
      .from("users")
      .select("id, company_id, email, first_name, last_name, avatar_url, role_id, status, must_change_password, created_at, updated_at")
      .eq("id", context.userId)
      .eq("company_id", context.companyId)
      .maybeSingle(),
    supabase
      .from("team_members")
      .select("team_id, teams(name)")
      .eq("user_id", context.userId),
  ]);

  if (error || !profile) {
    throw new Error("Unable to load profile.");
  }

  const firstTeam = (teams as Array<{ team_id: string; teams: { name: string } | null }> | null)?.[0];

  return {
    ...(profile as Database["public"]["Tables"]["users"]["Row"]),
    roleName: context.roleName,
    teamName: firstTeam?.teams?.name ?? null,
  };
}

export async function getCompanyBranding(context: AuthContext) {
  try {
    const data = await getCompanySettings(context);
    const settings = data.settings;

    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return null;
    }

    const branding = settings.branding;

    if (!branding || typeof branding !== "object" || Array.isArray(branding)) {
      return null;
    }

    return {
      primaryColor: typeof branding.primaryColor === "string" ? branding.primaryColor : null,
      secondaryColor: typeof branding.secondaryColor === "string" ? branding.secondaryColor : null,
      accentColor: typeof branding.accentColor === "string" ? branding.accentColor : null,
    };
  } catch {
    return null;
  }
}
