import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseRuntimeConfig, hasSupabaseRuntimeConfig } from "@/lib/env";
import {
  getRedirectPathForAuthState,
  isProtectedRoute,
  isPublicOrAuthRoute,
  isSetupRoute,
  isSuperiorAdminRoute,
  type RedirectAuthState,
} from "@/lib/auth/route-access";
import { normalizeRoleName } from "@/types/roles";
import type { Database } from "@/types/database";

type ProxyProfileRow = {
  company_id: string;
  role_id: string | null;
  status: "invited" | "active" | "suspended" | "disabled";
  must_change_password: boolean | null;
};

type ProxyCompanyRow = {
  status: Database["public"]["Enums"]["company_status"];
};

type ProxyRoleRow = {
  name: string;
};

type QueryDebugError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
} | null;

type ProxyAuthDebug = {
  userId: string;
  pathname: string;
  branch: string;
  userStatus: string | null;
  companyId: string | null;
  companyStatus: string | null;
  roleId: string | null;
  role: string | null;
  mustChangePassword: boolean | null;
  supabase: {
    profile: ProxyProfileRow | null;
    profileError: QueryDebugError;
    company: ProxyCompanyRow | null;
    companyError: QueryDebugError;
    role: ProxyRoleRow | null;
    roleError: QueryDebugError;
  };
};

function copySessionCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });

  source.headers.forEach((value, key) => {
    if (!target.headers.has(key) && key.toLowerCase() !== "location") {
      target.headers.set(key, value);
    }
  });

  return target;
}

function isBypassedPath(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/images/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.(?:css|js|map|txt|xml|ico|svg|png|jpg|jpeg|gif|webp|avif|woff|woff2|ttf|otf)$/i.test(pathname)
  );
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => (
    cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")
  ));
}

function proxyTiming(label: string, start: number) {
  if (process.env.CONTENTO_PROXY_TIMINGS === "true") {
    console.info(label, `${Math.round(performance.now() - start)}ms`);
  }
}

function queryDebugError(error: {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
} | null | undefined): QueryDebugError {
  return error
    ? {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      }
    : null;
}

function normalizeStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function logAccountInactiveRedirect(authState: RedirectAuthState, debug: ProxyAuthDebug | null) {
  console.warn("proxy account-inactive redirect", {
    authState,
    userId: debug?.userId ?? null,
    branch: debug?.branch ?? null,
    userStatus: debug?.userStatus ?? null,
    companyId: debug?.companyId ?? null,
    companyStatus: debug?.companyStatus ?? null,
    roleId: debug?.roleId ?? null,
    role: debug?.role ?? null,
    mustChangePassword: debug?.mustChangePassword ?? null,
    supabase: debug?.supabase ?? null,
  });
}

export async function proxy(request: NextRequest) {
  const start = performance.now();
  const pathname = request.nextUrl.pathname;
  if (isBypassedPath(pathname)) {
    return NextResponse.next();
  }

  const needsAuth = isProtectedRoute(pathname) || isSetupRoute(pathname);
  const needsAuthDecision = needsAuth || isPublicOrAuthRoute(pathname);

  if (!needsAuthDecision) {
    return NextResponse.next();
  }

  if (!hasSupabaseRuntimeConfig()) {
    if (needsAuth) {
      return NextResponse.redirect(new URL("/sign-in?error=configuration", request.url));
    }

    return NextResponse.next();
  }

  if (!hasSupabaseAuthCookie(request)) {
    if (needsAuth) {
      const redirectUrl = new URL("/sign-in", request.url);
      redirectUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseRuntimeConfig();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headersToSet).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  proxyTiming("proxy:session", start);

  if (userError || !user) {
    const redirectPath = getRedirectPathForAuthState(pathname, { state: "unauthenticated" });

    if (redirectPath) {
      const redirectUrl = new URL("/sign-in", request.url);
      redirectUrl.searchParams.set("redirectTo", pathname);
      return copySessionCookies(response, NextResponse.redirect(redirectUrl));
    }

    return response;
  }

  const userId = user.id;
  let authState: RedirectAuthState;
  let authDebug: ProxyAuthDebug | null = null;

  async function loadSuperiorAdminState() {
    const [{ data: platformAdmin }, { data: superiorAdmin }] = await Promise.all([
      supabase
        .from("platform_admins")
        .select("status")
        .eq("auth_user_id", userId)
        .maybeSingle(),
      supabase
        .from("superior_admins")
        .select("status")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    return platformAdmin?.status === "active" || superiorAdmin?.status === "active"
      ? ({ state: "superior_admin" } satisfies RedirectAuthState)
      : null;
  }

  async function loadCompanyUserState(): Promise<RedirectAuthState> {
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("company_id, role_id, status, must_change_password")
      .eq("id", userId)
      .maybeSingle();
    proxyTiming("proxy:profile", start);

    const profileRow = profile as ProxyProfileRow | null;
    authDebug = {
      userId,
      pathname,
      branch: "profile",
      userStatus: normalizeStatus(profileRow?.status),
      companyId: profileRow?.company_id ?? null,
      companyStatus: null,
      roleId: profileRow?.role_id ?? null,
      role: null,
      mustChangePassword: profileRow?.must_change_password ?? null,
      supabase: {
        profile: profileRow,
        profileError: queryDebugError(profileError),
        company: null,
        companyError: null,
        role: null,
        roleError: null,
      },
    };

    if (profileError) {
      authDebug.branch = "profile_error";
      return { state: "unresolved" };
    }

    if (!profileRow) {
      authDebug.branch = "missing_profile";
      return { state: "missing_profile" };
    }

    if (normalizeStatus(profileRow.status) !== "active") {
      authDebug.branch = "inactive_status";
      return { state: "inactive" };
    }

    if (!profileRow.company_id || !profileRow.role_id) {
      authDebug.branch = "incomplete_profile";
      return { state: "incomplete_profile" };
    }

    const [{ data: company, error: companyError }, { data: roleData, error: roleError }] = await Promise.all([
      supabase
        .from("companies")
        .select("status")
        .eq("id", profileRow.company_id)
        .maybeSingle(),
      supabase
        .from("roles")
        .select("name")
        .eq("id", profileRow.role_id)
        .maybeSingle(),
    ]);

    const companyRow = company as ProxyCompanyRow | null;
    const roleRow = roleData as ProxyRoleRow | null;
    const role = normalizeRoleName(roleRow?.name);

    authDebug.companyStatus = normalizeStatus(companyRow?.status);
    authDebug.role = roleRow?.name ?? null;
    authDebug.supabase.company = companyRow;
    authDebug.supabase.companyError = queryDebugError(companyError);
    authDebug.supabase.role = roleRow;
    authDebug.supabase.roleError = queryDebugError(roleError);

    if (companyError || !companyRow) {
      authDebug.branch = "company_unresolved";
      return { state: "unresolved" };
    }

    const companyStatus = normalizeStatus(companyRow.status);

    if (companyStatus === "disabled" || companyStatus === "suspended") {
      authDebug.branch = "organization_disabled";
      return { state: "organization_disabled" };
    }

    if (companyStatus === "deleted" || companyStatus === "archived") {
      authDebug.branch = "organization_unavailable";
      return { state: "organization_unavailable" };
    }

    if (roleError || !roleRow?.name || !role) {
      authDebug.branch = "role_unresolved";
      return { state: "unresolved" };
    }

    authDebug.branch = "active";

    return {
      state: "active",
      role,
      mustChangePassword: profileRow.must_change_password === true,
    };
  }

  if (isSuperiorAdminRoute(pathname)) {
    authState = await loadSuperiorAdminState() ?? await loadCompanyUserState();
  } else {
    authState = await loadCompanyUserState();

    if (authState.state !== "active") {
      authState = await loadSuperiorAdminState() ?? authState;
    }
  }

  const redirectPath = getRedirectPathForAuthState(pathname, authState);
  proxyTiming("proxy:route-access", start);

  if (redirectPath) {
    if (redirectPath === "/account-inactive") {
      logAccountInactiveRedirect(authState, authDebug);
    }

    return copySessionCookies(response, NextResponse.redirect(new URL(redirectPath, request.url)));
  }

  proxyTiming("proxy:total", start);
  return response;
}

export const config = {
  matcher: ["/((?!_next/|assets/|images/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:css|js|map|txt|xml|ico|svg|png|jpg|jpeg|gif|webp|avif|woff|woff2|ttf|otf)$).*)"],
};
