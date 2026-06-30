export type UserRole =
  | "admin"
  | "supervisor"
  | "team-lead"
  | "creator"
  | "graphic-designer"
  | "video-editor"
  | "client";

export type PermissionAccessLevel = "view" | "limited" | "full";
export type RoleCategory = "leadership" | "operations" | "production" | "client";

export type RoleDashboard = {
  role: UserRole;
  title: string;
  eyebrow: string;
  description: string;
  primaryFocus: string[];
  category?: RoleCategory;
};

export const roleDashboardPaths: Record<UserRole, string> = {
  admin: "/marketing-manager",
  supervisor: "/account-manager",
  "team-lead": "/team-lead",
  creator: "/content-creator",
  "graphic-designer": "/graphic-designer",
  "video-editor": "/video-editor",
  client: "/client",
};

export const legacyRoleDashboardPaths: Partial<Record<UserRole, string>> = {
  admin: "/admin",
  supervisor: "/supervisor",
  creator: "/creator",
};

export const roleDisplayNames: Record<UserRole, string> = {
  admin: "Marketing Manager",
  supervisor: "Account Manager",
  "team-lead": "Team Lead",
  creator: "Content Creator",
  "graphic-designer": "Graphic Designer",
  "video-editor": "Video Editor",
  client: "Client",
};

export const roleCategories: Record<UserRole, RoleCategory> = {
  admin: "leadership",
  supervisor: "operations",
  "team-lead": "operations",
  creator: "production",
  "graphic-designer": "production",
  "video-editor": "production",
  client: "client",
};

export function normalizeRoleName(roleName: string | null | undefined): UserRole | null {
  if (!roleName) {
    return null;
  }

  const normalized = roleName.trim().toLowerCase();

  if (normalized === "admin" || normalized === "marketing manager") {
    return "admin";
  }

  if (normalized === "supervisor" || normalized === "account manager") {
    return "supervisor";
  }

  if (normalized === "cc team lead" || normalized === "team lead" || normalized === "team-lead") {
    return "team-lead";
  }

  if (normalized === "creator" || normalized === "content creator") {
    return "creator";
  }

  if (normalized === "graphic designer" || normalized === "designer") {
    return "graphic-designer";
  }

  if (normalized === "video editor" || normalized === "editor") {
    return "video-editor";
  }

  if (normalized === "client") {
    return "client";
  }

  return null;
}

export function getRoleDisplayName(role: UserRole | string | null | undefined) {
  const normalizedRole = typeof role === "string" ? normalizeRoleName(role) : null;

  if (!role) {
    return "Unassigned";
  }

  return normalizedRole ? roleDisplayNames[normalizedRole] : role;
}

export function isProductionRole(role: UserRole | null | undefined) {
  return role === "creator" || role === "graphic-designer" || role === "video-editor";
}

export function getDefaultDashboardPath(role: UserRole | null) {
  return role ? roleDashboardPaths[role] : "/sign-in";
}
