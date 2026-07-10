import { type UserRole, getDefaultDashboardPath } from "@/types/roles";
import type { AuthProfileResolution } from "@/lib/auth/context";

const authRoutes = ["/sign-in", "/forgot-password"];
const publicRoutes = ["/", "/reset-password", "/auth/callback"];
const onboardingRoutes = ["/onboarding"];
const accountInactiveRoutes = ["/account-inactive"];
const organizationDisabledRoutes = ["/organization-disabled"];
const organizationUnavailableRoutes = ["/organization-unavailable"];
const demoRoutes = ["/demo/choose-role"];
const sharedProtectedRoutes = [
  "/profile",
  "/users",
  "/change-password",
  "/clients",
  "/team",
  "/tasks",
  "/ideas",
  "/content",
  "/reviews",
  "/calendar",
  "/reports",
  "/notifications",
  "/search",
  "/settings",
];
const superiorAdminRoutes = ["/super-admin"];

const protectedRouteRoles: Array<{ prefix: string; role: UserRole }> = [
  { prefix: "/admin", role: "admin" },
  { prefix: "/marketing-manager", role: "admin" },
  { prefix: "/supervisor", role: "supervisor" },
  { prefix: "/account-manager", role: "supervisor" },
  { prefix: "/team-lead", role: "team-lead" },
  { prefix: "/creator", role: "creator" },
  { prefix: "/content-creator", role: "creator" },
  { prefix: "/graphic-designer", role: "graphic-designer" },
  { prefix: "/video-editor", role: "video-editor" },
  { prefix: "/client", role: "client" },
];

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isAuthRoute(pathname: string) {
  return authRoutes.some((route) => matchesPathPrefix(pathname, route));
}

export function isPublicRoute(pathname: string) {
  return publicRoutes.some((route) => matchesPathPrefix(pathname, route));
}

export function isOnboardingRoute(pathname: string) {
  return onboardingRoutes.some((route) => matchesPathPrefix(pathname, route));
}

export function isAccountInactiveRoute(pathname: string) {
  return accountInactiveRoutes.some((route) => matchesPathPrefix(pathname, route));
}

export function isOrganizationDisabledRoute(pathname: string) {
  return organizationDisabledRoutes.some((route) => matchesPathPrefix(pathname, route));
}

export function isOrganizationUnavailableRoute(pathname: string) {
  return organizationUnavailableRoutes.some((route) => matchesPathPrefix(pathname, route));
}

export function isSuperiorAdminRoute(pathname: string) {
  return superiorAdminRoutes.some((route) => matchesPathPrefix(pathname, route));
}

export function isChangePasswordRoute(pathname: string) {
  return matchesPathPrefix(pathname, "/change-password");
}

export function isDemoRoute(pathname: string) {
  return demoRoutes.some((route) => matchesPathPrefix(pathname, route));
}

export function isSetupRoute(pathname: string) {
  return (
    isOnboardingRoute(pathname) ||
    isAccountInactiveRoute(pathname) ||
    isOrganizationDisabledRoute(pathname) ||
    isOrganizationUnavailableRoute(pathname) ||
    isDemoRoute(pathname) ||
    isChangePasswordRoute(pathname)
  );
}

export function isPublicOrAuthRoute(pathname: string) {
  return isPublicRoute(pathname) || isAuthRoute(pathname);
}

export function getProtectedRouteRole(pathname: string) {
  return protectedRouteRoles.find((route) => matchesPathPrefix(pathname, route.prefix))?.role ?? null;
}

export function isProtectedRoute(pathname: string) {
  return (
    Boolean(getProtectedRouteRole(pathname)) ||
    sharedProtectedRoutes.some((route) => matchesPathPrefix(pathname, route)) ||
    isSuperiorAdminRoute(pathname)
  );
}

export function canAccessProtectedRoute(userRole: UserRole, pathname: string) {
  const routeRole = getProtectedRouteRole(pathname);

  if (!routeRole) {
    return true;
  }

  return userRole === routeRole;
}

export function getUnauthorizedRedirectPath(userRole: UserRole | null) {
  return getDefaultDashboardPath(userRole);
}

export type RedirectAuthState =
  | { state: "unauthenticated" }
  | { state: "superior_admin" }
  | { state: "missing_profile" }
  | { state: "demo_needs_role" }
  | { state: "organization_disabled" | "organization_unavailable" }
  | { state: "inactive" | "incomplete_profile" | "unresolved" }
  | { state: "active"; role: UserRole; mustChangePassword: boolean };

function normalizeRedirect(pathname: string, destination: string) {
  return pathname === destination ? null : destination;
}

export function redirectStateFromResolution(resolution: AuthProfileResolution): RedirectAuthState {
  if (resolution.state === "active") {
    return {
      state: "active",
      role: resolution.context.role,
      mustChangePassword: resolution.context.mustChangePassword,
    };
  }

  if (resolution.state === "superior_admin") {
    return { state: "superior_admin" };
  }

  if (resolution.state === "missing_profile") {
    return { state: "missing_profile" };
  }

  if (resolution.state === "demo_needs_role") {
    return { state: "demo_needs_role" };
  }

  if (resolution.state === "organization_disabled" || resolution.state === "organization_unavailable") {
    return { state: resolution.state };
  }

  if (
    resolution.state === "inactive" ||
    resolution.state === "incomplete_profile" ||
    resolution.state === "unresolved"
  ) {
    return { state: resolution.state };
  }

  return { state: "unauthenticated" };
}

// Single redirect decision tree used by proxy and auth pages.
// It intentionally allows each account state to remain only on its canonical page
// to avoid loops between middleware and page-level redirects.
export function getRedirectPathForAuthState(pathname: string, authState: RedirectAuthState) {
  if (authState.state === "unauthenticated") {
    return isProtectedRoute(pathname) || isSetupRoute(pathname)
      ? normalizeRedirect(pathname, "/sign-in")
      : null;
  }

  if (authState.state === "superior_admin") {
    return isSuperiorAdminRoute(pathname) ? null : normalizeRedirect(pathname, "/super-admin");
  }

  if (authState.state === "missing_profile") {
    return isOnboardingRoute(pathname) ? null : normalizeRedirect(pathname, "/onboarding");
  }

  if (authState.state === "demo_needs_role") {
    return isDemoRoute(pathname) ? null : normalizeRedirect(pathname, "/demo/choose-role");
  }

  if (authState.state === "organization_disabled") {
    return isOrganizationDisabledRoute(pathname) ? null : normalizeRedirect(pathname, "/organization-disabled");
  }

  if (authState.state === "organization_unavailable") {
    return isOrganizationUnavailableRoute(pathname) ? null : normalizeRedirect(pathname, "/organization-unavailable");
  }

  if (
    authState.state === "inactive" ||
    authState.state === "incomplete_profile" ||
    authState.state === "unresolved"
  ) {
    return isAccountInactiveRoute(pathname) ? null : normalizeRedirect(pathname, "/account-inactive");
  }

  if (authState.state !== "active") {
    return null;
  }

  if (authState.mustChangePassword) {
    return isChangePasswordRoute(pathname) ? null : normalizeRedirect(pathname, "/change-password");
  }

  if (isPublicOrAuthRoute(pathname) || (isSetupRoute(pathname) && !isDemoRoute(pathname))) {
    return normalizeRedirect(pathname, getDefaultDashboardPath(authState.role));
  }

  if (isProtectedRoute(pathname) && !canAccessProtectedRoute(authState.role, pathname)) {
    return normalizeRedirect(pathname, getUnauthorizedRedirectPath(authState.role));
  }

  return null;
}

export function getRedirectPathForAuthResolution(
  pathname: string,
  resolution: AuthProfileResolution
) {
  return getRedirectPathForAuthState(pathname, redirectStateFromResolution(resolution));
}
