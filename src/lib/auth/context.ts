import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext, PermissionGrant } from "@/lib/auth/permissions";
import { AuthorizationError, hasPermission, hasRole } from "@/lib/auth/permissions";
import { hasSupabaseRuntimeConfig } from "@/lib/env";
import type { Database } from "@/types/database";
import {
  getDefaultDashboardPath,
  normalizeRoleName,
  type PermissionAccessLevel,
  type UserRole,
} from "@/types/roles";

type ProfileRow = {
  id: string;
  company_id: string;
  email: string;
  role_id: string | null;
  status: AuthContext["status"];
  must_change_password: boolean | null;
};

type RoleRow = {
  id: string;
  name: string;
};

type RolePermissionRow = {
  permission_id: string;
  access_level: PermissionAccessLevel;
};

type PermissionRow = {
  id: string;
  key: string;
};

type AuthUserSummary = {
  id: string;
  email: string | null;
};

export type SuperiorAdminContext = {
  userId: string;
  email: string;
  status: "active" | "suspended";
};

export type AuthProfileResolution =
  | { state: "unauthenticated" }
  | { state: "superior_admin"; user: AuthUserSummary; superiorAdmin: SuperiorAdminContext }
  | { state: "missing_profile"; user: AuthUserSummary }
  | { state: "inactive"; user: AuthUserSummary; profile: ProfileRow }
  | { state: "incomplete_profile"; user: AuthUserSummary; profile: ProfileRow; message: string }
  | { state: "unresolved"; user: AuthUserSummary; message: string }
  | { state: "active"; user: AuthUserSummary; context: AuthContext };

export async function loadAuthProfile(
  supabase: SupabaseClient<Database>
): Promise<AuthProfileResolution> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { state: "unauthenticated" };
  }

  const authUser = {
    id: user.id,
    email: user.email ?? null,
  };

  const { data: superiorAdmin } = await supabase
    .from("superior_admins")
    .select("id, email, status")
    .eq("id", user.id)
    .maybeSingle();

  if (superiorAdmin?.status === "active") {
    return {
      state: "superior_admin",
      user: authUser,
      superiorAdmin: {
        userId: superiorAdmin.id,
        email: superiorAdmin.email,
        status: superiorAdmin.status,
      },
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, company_id, email, role_id, status, must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      state: "unresolved",
      user: authUser,
      message: "We could not resolve your Contento profile.",
    };
  }

  if (!profile) {
    return { state: "missing_profile", user: authUser };
  }

  const profileRow = profile as ProfileRow;

  if (profileRow.status !== "active") {
    return { state: "inactive", user: authUser, profile: profileRow };
  }

  if (!profileRow.company_id || !profileRow.role_id) {
    return {
      state: "incomplete_profile",
      user: authUser,
      profile: profileRow,
      message: "Your Contento profile is missing workspace or role access.",
    };
  }

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id, name")
    .eq("id", profileRow.role_id)
    .maybeSingle();

  const roleRow = role as RoleRow | null;
  const normalizedRole = normalizeRoleName(roleRow?.name);

  if (roleError || !roleRow?.name || !normalizedRole) {
    return {
      state: "incomplete_profile",
      user: authUser,
      profile: profileRow,
      message: "Your Contento role could not be resolved.",
    };
  }

  const { data: rolePermissions, error: permissionsError } = await supabase
    .from("role_permissions")
    .select("permission_id, access_level")
    .eq("role_id", profileRow.role_id);

  if (permissionsError) {
    return {
      state: "unresolved",
      user: authUser,
      message: "We could not resolve your Contento permissions.",
    };
  }

  const rolePermissionRows = (rolePermissions as RolePermissionRow[] | null) ?? [];
  const permissionIds = Array.from(
    new Set(rolePermissionRows.map((permission) => permission.permission_id))
  );
  const { data: permissionRows, error: permissionCatalogError } = permissionIds.length
    ? await supabase.from("permissions").select("id, key").in("id", permissionIds)
    : { data: [], error: null };

  if (permissionCatalogError) {
    return {
      state: "unresolved",
      user: authUser,
      message: "We could not resolve your Contento permission catalog.",
    };
  }

  const permissionKeyById = new Map(
    ((permissionRows as PermissionRow[] | null) ?? []).map((permission) => [permission.id, permission.key])
  );

  const permissions: PermissionGrant[] = rolePermissionRows
    .map((permission) => {
      const permissionKey = permissionKeyById.get(permission.permission_id);

      if (!permissionKey) {
        return null;
      }

      return {
        key: permissionKey,
        accessLevel: permission.access_level,
      };
    })
    .filter((permission): permission is PermissionGrant => Boolean(permission));

  return {
    state: "active",
    user: authUser,
    context: {
      userId: profileRow.id,
      email: profileRow.email,
      companyId: profileRow.company_id,
      roleId: profileRow.role_id,
      roleName: roleRow.name,
      role: normalizedRole,
      status: profileRow.status,
      mustChangePassword: Boolean(profileRow.must_change_password),
      permissions,
    },
  };
}


export async function resolveAuthProfile(): Promise<AuthProfileResolution> {
  if (!hasSupabaseRuntimeConfig()) {
    return { state: "unauthenticated" };
  }

  const supabase = await createSupabaseServerClient();
  return loadAuthProfile(supabase);
}

export async function getAuthContext() {
  const resolution = await resolveAuthProfile();

  if (resolution.state !== "active") {
    return null;
  }

  return resolution.context;
}

export async function requireAuthContext() {
  const resolution = await resolveAuthProfile();

  if (resolution.state === "active") {
    if (resolution.context.mustChangePassword) {
      redirect("/change-password");
    }

    return resolution.context;
  }

  if (resolution.state === "superior_admin") {
    redirect("/super-admin");
  }

  if (resolution.state === "missing_profile") {
    redirect("/onboarding");
  }

  if (resolution.state === "unauthenticated") {
    redirect("/sign-in");
  }

  redirect("/account-inactive");
}

export async function requireSuperiorAdminContext() {
  const resolution = await resolveAuthProfile();

  if (resolution.state === "superior_admin") {
    return resolution.superiorAdmin;
  }

  if (resolution.state === "unauthenticated") {
    redirect("/sign-in");
  }

  redirect("/account-inactive");
}

export async function requireRole(roles: UserRole | UserRole[]) {
  const context = await requireAuthContext();

  if (!hasRole(context, roles)) {
    redirect(getDefaultDashboardPath(context.role));
  }

  return context;
}

export async function requirePermission(
  permissionKey: string,
  minimumAccess: PermissionAccessLevel = "limited"
) {
  const context = await requireAuthContext();

  if (!hasPermission(context, permissionKey, minimumAccess)) {
    throw new AuthorizationError();
  }

  return context;
}

export async function requireDashboardAccess(dashboardRole: UserRole) {
  const context = await requireAuthContext();

  if (context.role === dashboardRole) {
    return context;
  }

  redirect(getDefaultDashboardPath(context.role));
}
