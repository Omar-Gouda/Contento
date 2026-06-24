import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseRuntimeConfig, hasSupabaseRuntimeConfig } from "@/lib/env";
import {
  getRedirectPathForAuthState,
  isProtectedRoute,
  isSetupRoute,
  type RedirectAuthState,
} from "@/lib/auth/route-access";
import { normalizeRoleName } from "@/types/roles";
import type { Database } from "@/types/database";

type ProxyProfileRow = {
  role_id: string | null;
  status: "invited" | "active" | "suspended" | "disabled";
  must_change_password: boolean | null;
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

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const needsAuth = isProtectedRoute(pathname) || isSetupRoute(pathname);

  if (!hasSupabaseRuntimeConfig()) {
    if (needsAuth) {
      return NextResponse.redirect(new URL("/sign-in?error=configuration", request.url));
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

  if (userError || !user) {
    const redirectPath = getRedirectPathForAuthState(pathname, { state: "unauthenticated" });

    if (redirectPath) {
      const redirectUrl = new URL("/sign-in", request.url);
      redirectUrl.searchParams.set("redirectTo", pathname);
      return copySessionCookies(response, NextResponse.redirect(redirectUrl));
    }

    return response;
  }

  const { data: superiorAdmin } = await supabase
    .from("superior_admins")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  let authState: RedirectAuthState;

  if (superiorAdmin?.status === "active") {
    authState = { state: "superior_admin" };
  } else {
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role_id, status, must_change_password")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      authState = { state: "unresolved" };
    } else {
      const profileRow = profile as ProxyProfileRow | null;

      if (!profileRow) {
        authState = { state: "missing_profile" };
      } else if (profileRow.status !== "active" || !profileRow.role_id) {
        authState = { state: "inactive" };
      } else {
        const { data: roleData, error: roleError } = await supabase
          .from("roles")
          .select("name")
          .eq("id", profileRow.role_id)
          .maybeSingle();

        const role = normalizeRoleName(roleData?.name);

        authState = roleError || !role
          ? { state: "unresolved" }
          : {
              state: "active",
              role,
              mustChangePassword: profileRow.must_change_password === true,
            };
      }
    }
  }

  const redirectPath = getRedirectPathForAuthState(pathname, authState);

  if (redirectPath) {
    return copySessionCookies(response, NextResponse.redirect(new URL(redirectPath, request.url)));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
