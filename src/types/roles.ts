export type UserRole = "admin" | "supervisor" | "team-lead" | "creator";

export type PermissionAccessLevel = "view" | "limited" | "full";

export type RoleDashboard = {
  role: UserRole;
  title: string;
  eyebrow: string;
  description: string;
  primaryFocus: string[];
};

export const roleDashboardPaths: Record<UserRole, string> = {
  admin: "/admin",
  supervisor: "/supervisor",
  "team-lead": "/team-lead",
  creator: "/creator",
};

export function normalizeRoleName(roleName: string | null | undefined): UserRole | null {
  if (!roleName) {
    return null;
  }

  const normalized = roleName.trim().toLowerCase();

  if (normalized === "admin") {
    return "admin";
  }

  if (normalized === "supervisor") {
    return "supervisor";
  }

  if (normalized === "cc team lead" || normalized === "team lead" || normalized === "team-lead") {
    return "team-lead";
  }

  if (normalized === "creator") {
    return "creator";
  }

  return null;
}

export function getDefaultDashboardPath(role: UserRole | null) {
  return role ? roleDashboardPaths[role] : "/sign-in";
}
