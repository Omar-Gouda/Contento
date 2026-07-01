import type { PermissionAccessLevel, UserRole } from "@/types/roles";

const accessRank: Record<PermissionAccessLevel, number> = {
  view: 1,
  limited: 2,
  full: 3,
};

export type PermissionGrant = {
  key: string;
  accessLevel: PermissionAccessLevel;
};

export type AuthContext = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  companyId: string;
  roleId: string;
  roleName: string;
  role: UserRole;
  status: "invited" | "active" | "suspended" | "disabled";
  mustChangePassword: boolean;
  permissions: PermissionGrant[];
};

export function hasRole(context: AuthContext | null, roles: UserRole | UserRole[]) {
  if (!context) {
    return false;
  }

  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return allowedRoles.includes(context.role);
}

export function hasPermission(
  context: AuthContext | null,
  permissionKey: string,
  minimumAccess: PermissionAccessLevel = "limited"
) {
  if (!context) {
    return false;
  }

  const grant = context.permissions.find((permission) => permission.key === permissionKey);

  if (!grant) {
    return false;
  }

  return accessRank[grant.accessLevel] >= accessRank[minimumAccess];
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to access this resource.") {
    super(message);
    this.name = "AuthorizationError";
  }
}
