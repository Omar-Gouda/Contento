import { NextResponse, type NextRequest } from "next/server";

import { loadAuthProfile } from "@/lib/auth/context";
import { hasSupabaseRuntimeConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordSignInForSupabaseClient } from "@/lib/work-hours/actions";
import { getDefaultDashboardPath } from "@/types/roles";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const redirectTo = new URL(next, requestUrl.origin);

  if (!hasSupabaseRuntimeConfig()) {
    return NextResponse.redirect(new URL("/sign-in?error=configuration", requestUrl.origin));
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);

    if (next !== "/reset-password") {
      const initialResolution = await loadAuthProfile(supabase);

      if (initialResolution.state === "missing_profile") {
        await supabase.rpc("accept_pending_invitation_for_current_user", {});
      }

      const resolution = await loadAuthProfile(supabase);

      if (resolution.state === "superior_admin") {
        return NextResponse.redirect(new URL("/super-admin", requestUrl.origin));
      }

      if (resolution.state === "active") {
        await recordSignInForSupabaseClient(supabase);
        const destination = resolution.context.mustChangePassword
          ? "/change-password"
          : getDefaultDashboardPath(resolution.context.role);

        return NextResponse.redirect(new URL(destination, requestUrl.origin));
      }
    }
  }

  return NextResponse.redirect(redirectTo);
}
