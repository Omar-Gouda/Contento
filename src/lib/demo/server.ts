import "server-only";

import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseAdminConfig } from "@/lib/env";
import { CONTENTO_TIME_ZONE } from "@/lib/time";
import {
  DEMO_COMPANY_NAME,
  DEMO_COMPANY_SLUG,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_ROLE_COOKIE,
  DEMO_SESSION_COOKIE,
  DEMO_TTL_MINUTES,
} from "@/lib/demo/config";
import { normalizeRoleName, type UserRole } from "@/types/roles";
import type { Database } from "@/types/database";

type DemoSessionRow = Database["public"]["Tables"]["demo_sessions"]["Row"];
type DemoUserProfile = {
  id: string;
  company_id: string;
  email: string;
  is_demo?: boolean | null;
};
type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

const demoCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: DEMO_TTL_MINUTES * 60,
};

function expiresAt() {
  return new Date(Date.now() + DEMO_TTL_MINUTES * 60 * 1000).toISOString();
}

function readSupabaseError(error: unknown): SupabaseLikeError {
  if (!error || typeof error !== "object") {
    return {};
  }

  const record = error as Record<string, unknown>;

  return {
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
    details: typeof record.details === "string" ? record.details : undefined,
    hint: typeof record.hint === "string" ? record.hint : undefined,
  };
}

function logDemoSignInFailure(step: string, error?: unknown) {
  const supabaseError = readSupabaseError(error);

  console.error("demo sign-in failed", {
    step,
    code: supabaseError.code,
    message: supabaseError.message,
    details: supabaseError.details,
    hint: supabaseError.hint,
  });
}

function throwDemoSignInFailure(step: string, error: unknown, fallbackMessage: string): never {
  logDemoSignInFailure(step, error);
  const message = readSupabaseError(error).message ?? fallbackMessage;
  throw new Error(`${step}: ${message}`);
}

async function getCookieStore() {
  return cookies();
}

export async function getDemoSessionCookie() {
  const cookieStore = await getCookieStore();
  return cookieStore.get(DEMO_SESSION_COOKIE)?.value ?? null;
}

export async function setDemoCookies(sessionId: string, role?: UserRole | null) {
  const cookieStore = await getCookieStore();
  cookieStore.set(DEMO_SESSION_COOKIE, sessionId, demoCookieOptions);

  if (role) {
    cookieStore.set(DEMO_ROLE_COOKIE, role, demoCookieOptions);
  } else {
    cookieStore.delete(DEMO_ROLE_COOKIE);
  }
}

export async function clearDemoCookies() {
  const cookieStore = await getCookieStore();
  cookieStore.delete(DEMO_SESSION_COOKIE);
  cookieStore.delete(DEMO_ROLE_COOKIE);
}

async function findAuthUserIdByEmail(admin: ReturnType<typeof createSupabaseAdminClient>, email: string) {
  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (profileError) {
    throwDemoSignInFailure("demo_profile_auth_lookup", profileError, "Demo profile lookup failed.");
  }

  if (profile?.id) {
    return profile.id;
  }

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) {
      throwDemoSignInFailure("demo_auth_list_users", error, "Demo auth user lookup failed.");
    }

    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

    if (match) {
      return match.id;
    }

    if (data.users.length < 1000) {
      break;
    }
  }

  return null;
}

async function ensureDemoCompany(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data: existingCompany, error: lookupError } = await admin
    .from("companies")
    .select("id")
    .eq("slug", DEMO_COMPANY_SLUG)
    .maybeSingle();

  if (lookupError) {
    throwDemoSignInFailure("demo_company_lookup", lookupError, "Demo company lookup failed.");
  }

  if (existingCompany?.id) {
    const { error: updateError } = await admin
      .from("companies")
      .update({
        name: DEMO_COMPANY_NAME,
        status: "active",
        is_demo: true,
      })
      .eq("id", existingCompany.id);

    if (updateError) {
      throwDemoSignInFailure("demo_company_update", updateError, "Demo company update failed.");
    }

    await ensureDemoCompanySettings(admin, existingCompany.id);

    return existingCompany.id;
  }

  const { data: company, error } = await admin
    .from("companies")
    .insert({
      name: DEMO_COMPANY_NAME,
      slug: DEMO_COMPANY_SLUG,
      status: "active",
      is_demo: true,
    })
    .select("id")
    .single();

  if (error || !company) {
    throwDemoSignInFailure("demo_company_insert", error, "Demo company insert failed.");
  }

  await ensureDemoCompanySettings(admin, company.id);

  return company.id;
}

async function ensureDemoCompanySettings(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  companyId: string
) {
  const { error: settingsError } = await admin
    .from("company_settings")
    .upsert({
      company_id: companyId,
      settings_json: {
        demo: true,
      },
    }, { onConflict: "company_id" });

  if (settingsError) {
    throwDemoSignInFailure("demo_company_settings_upsert", settingsError, "Demo company settings update failed.");
  }
}

async function getRoleId(admin: ReturnType<typeof createSupabaseAdminClient>, companyId: string, role: UserRole) {
  const { data: roles, error } = await admin
    .from("roles")
    .select("id, name")
    .eq("company_id", companyId);

  if (error) {
    throwDemoSignInFailure("demo_role_lookup", error, "Demo role lookup failed.");
  }

  const match = ((roles as Array<{ id: string; name: string }> | null) ?? [])
    .find((row) => normalizeRoleName(row.name) === role);

  return match?.id ?? null;
}

export async function ensurePublicDemoAccount() {
  if (!hasSupabaseAdminConfig()) {
    logDemoSignInFailure("configuration", { message: "Demo mode requires Supabase admin configuration." });
    throw new Error("Demo mode requires Supabase admin configuration.");
  }

  const admin = createSupabaseAdminClient();
  const companyId = await ensureDemoCompany(admin);
  let authUserId = await findAuthUserIdByEmail(admin, DEMO_EMAIL);

  if (!authUserId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        contento_demo: true,
      },
    });

    if (error || !data.user) {
      throwDemoSignInFailure("demo_auth_user_create", error, "Demo auth user create failed.");
    }

    authUserId = data.user.id;
  } else {
    const { error: updateUserError } = await admin.auth.admin.updateUserById(authUserId, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        contento_demo: true,
      },
    });

    if (updateUserError) {
      throwDemoSignInFailure("demo_auth_user_update", updateUserError, "Demo auth user update failed.");
    }
  }

  const adminRoleId = await getRoleId(admin, companyId, "admin");

  if (!adminRoleId) {
    logDemoSignInFailure("demo_role_lookup", { message: "Demo Marketing Manager role could not be resolved." });
    throw new Error("Demo Marketing Manager role could not be resolved.");
  }

  const { error: profileError } = await admin.from("users").upsert({
    id: authUserId,
    company_id: companyId,
    email: DEMO_EMAIL,
    first_name: "Demo",
    last_name: "Visitor",
    role_id: adminRoleId,
    status: "active",
    must_change_password: false,
    is_demo: true,
    demo_session_id: null,
    demo_expires_at: null,
  });

  if (profileError) {
    throwDemoSignInFailure("demo_profile_upsert", profileError, "Demo profile update failed.");
  }

  const { error: ownerError } = await admin.from("companies").update({ owner_user_id: authUserId }).eq("id", companyId);

  if (ownerError) {
    throwDemoSignInFailure("demo_company_owner_update", ownerError, "Demo company owner update failed.");
  }

  await cleanupExpiredDemoSessions();
}

export async function createDemoSessionForCurrentUser(
  supabase?: SupabaseClient<Database>
) {
  const client = supabase ?? await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    logDemoSignInFailure("demo_session_auth_user", userError ?? { message: "No authenticated demo user." });
    return null;
  }

  const { data: profile, error: profileError } = await client
    .from("users")
    .select("id, company_id, email, is_demo")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("public demo profile lookup failed", {
      code: profileError.code,
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
    });

    return null;
  }

  if (!profile?.is_demo) {
    logDemoSignInFailure("demo_session_profile_not_demo", { message: "Authenticated user is not marked as demo." });
    return null;
  }

  const currentSessionId = await getDemoSessionCookie();
  const expires = expiresAt();

  if (currentSessionId) {
    const { data: existingSession, error: existingSessionError } = await client
      .from("demo_sessions")
      .update({
        status: "active",
        expires_at: expires,
      })
      .eq("id", currentSessionId)
      .eq("company_id", profile.company_id)
      .eq("auth_user_id", profile.id)
      .select("id")
      .maybeSingle();

    if (existingSessionError) {
      logDemoSignInFailure("demo_session_reuse", existingSessionError);
    }

    if (existingSession?.id) {
      const { error: profileUpdateError } = await client
        .from("users")
        .update({
          demo_session_id: existingSession.id,
          demo_expires_at: expires,
        })
        .eq("id", profile.id);

      if (profileUpdateError) {
        logDemoSignInFailure("demo_session_profile_update", profileUpdateError);
      }

      await setDemoCookies(existingSession.id, null);
      return existingSession.id;
    }
  }

  const { data: session, error } = await client
    .from("demo_sessions")
    .insert({
      company_id: profile.company_id,
      auth_user_id: profile.id,
      role_name: null,
      status: "active",
      expires_at: expires,
    })
    .select("id")
    .single();

  if (error || !session) {
    logDemoSignInFailure("demo_session_insert", error);

    return null;
  }

  const { error: profileUpdateError } = await client
    .from("users")
    .update({
      demo_session_id: session.id,
      demo_expires_at: expires,
    })
    .eq("id", profile.id);

  if (profileUpdateError) {
    logDemoSignInFailure("demo_session_profile_update", profileUpdateError);
  }

  await setDemoCookies(session.id, null);
  return session.id;
}

export async function getActiveDemoSession(
  supabase: SupabaseClient<Database>,
  profile: DemoUserProfile
): Promise<DemoSessionRow | null> {
  if (!profile.is_demo) {
    return null;
  }

  const sessionId = await getDemoSessionCookie();

  if (!sessionId) {
    return null;
  }

  const { data: session } = await supabase
    .from("demo_sessions")
    .select("id, company_id, auth_user_id, role_name, status, expires_at, created_at, updated_at")
    .eq("id", sessionId)
    .eq("company_id", profile.company_id)
    .eq("auth_user_id", profile.id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return (session as DemoSessionRow | null) ?? null;
}

export async function cleanupDemoSession(sessionId: string) {
  if (!hasSupabaseAdminConfig()) {
    return;
  }

  const admin = createSupabaseAdminClient();
  const cleanupSteps: Array<{
    tableName: string;
    run: () => Promise<{ error: { code?: string; message: string } | null }>;
  }> = [
    { tableName: "attachments", run: async () => admin.from("attachments").delete().eq("demo_session_id", sessionId) },
    { tableName: "comments", run: async () => admin.from("comments").delete().eq("demo_session_id", sessionId) },
    { tableName: "task_comments", run: async () => admin.from("task_comments").delete().eq("demo_session_id", sessionId) },
    { tableName: "content_reviews", run: async () => admin.from("content_reviews").delete().eq("demo_session_id", sessionId) },
    { tableName: "content_ratings", run: async () => admin.from("content_ratings").delete().eq("demo_session_id", sessionId) },
    { tableName: "client_assignments", run: async () => admin.from("client_assignments").delete().eq("demo_session_id", sessionId) },
    { tableName: "team_members", run: async () => admin.from("team_members").delete().eq("demo_session_id", sessionId) },
    { tableName: "notifications", run: async () => admin.from("notifications").delete().eq("demo_session_id", sessionId) },
    { tableName: "calendar_events", run: async () => admin.from("calendar_events").delete().eq("demo_session_id", sessionId) },
    { tableName: "day_off_requests", run: async () => admin.from("day_off_requests").delete().eq("demo_session_id", sessionId) },
    { tableName: "reports", run: async () => admin.from("reports").delete().eq("demo_session_id", sessionId) },
    { tableName: "content_items", run: async () => admin.from("content_items").delete().eq("demo_session_id", sessionId) },
    { tableName: "ideas", run: async () => admin.from("ideas").delete().eq("demo_session_id", sessionId) },
    { tableName: "tasks", run: async () => admin.from("tasks").delete().eq("demo_session_id", sessionId) },
    { tableName: "clients", run: async () => admin.from("clients").delete().eq("demo_session_id", sessionId) },
    { tableName: "teams", run: async () => admin.from("teams").delete().eq("demo_session_id", sessionId) },
    { tableName: "activity_logs", run: async () => admin.from("activity_logs").delete().eq("demo_session_id", sessionId) },
  ];

  for (const step of cleanupSteps) {
    const { error } = await step.run();

    if (error) {
      console.warn("Demo cleanup table failed", {
        tableName: step.tableName,
        code: error.code,
        message: error.message,
      });
    }
  }

  await admin.from("demo_sessions").update({ status: "ended" }).eq("id", sessionId);
  await admin
    .from("users")
    .update({
      first_name: "Demo",
      last_name: "Visitor",
      phone: null,
      job_title: null,
      bio: "",
      timezone: CONTENTO_TIME_ZONE,
      avatar_url: null,
      notification_preferences: {
        sound: false,
        toast: true,
        desktop: false,
      },
      demo_session_id: null,
      demo_expires_at: null,
    })
    .eq("demo_session_id", sessionId);
}

export async function cleanupExpiredDemoSessions() {
  if (!hasSupabaseAdminConfig()) {
    return;
  }

  const admin = createSupabaseAdminClient();
  const { data: expiredSessions } = await admin
    .from("demo_sessions")
    .select("id")
    .eq("status", "active")
    .lte("expires_at", new Date().toISOString());

  for (const session of (expiredSessions as Array<{ id: string }> | null) ?? []) {
    await cleanupDemoSession(session.id);
    await admin.from("demo_sessions").update({ status: "expired" }).eq("id", session.id);
  }
}

export async function cleanupCurrentDemoSession() {
  const sessionId = await getDemoSessionCookie();

  if (sessionId) {
    await cleanupDemoSession(sessionId);
  }

  await clearDemoCookies();
}

export async function seedDemoData(sessionId: string, role: UserRole) {
  if (!hasSupabaseAdminConfig()) {
    return;
  }

  const admin = createSupabaseAdminClient();
  const { data: session } = await admin
    .from("demo_sessions")
    .select("id, company_id, auth_user_id, expires_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return;
  }

  const nextExpiresAt = expiresAt();
  await cleanupDemoSession(sessionId);
  await admin
    .from("demo_sessions")
    .update({ status: "active", role_name: role, expires_at: nextExpiresAt })
    .eq("id", sessionId);
  await admin
    .from("users")
    .update({ demo_session_id: sessionId, demo_expires_at: nextExpiresAt })
    .eq("id", session.auth_user_id);

  const marker = {
    demo_session_id: sessionId,
    created_by_demo: true,
    demo_expires_at: nextExpiresAt,
  };

  const today = new Date();
  const inDays = (days: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };
  const atDays = (days: number, hour = 10) => `${inDays(days)}T${String(hour).padStart(2, "0")}:00:00.000Z`;

  const { data: clients } = await admin
    .from("clients")
    .insert([
      {
        company_id: session.company_id,
        name: "Aurora Skincare",
        slug: `aurora-skincare-${sessionId.slice(0, 8)}`,
        contact_person: "Nadine Farouk",
        contact_email: "nadine@example.test",
        notes: "Premium launch campaign with weekly approvals.",
        requirements: "Elegant product education content and paid social assets.",
        assigned_account_manager_id: session.auth_user_id,
        created_by: session.auth_user_id,
        ...marker,
      },
      {
        company_id: session.company_id,
        name: "Northstar Fitness",
        slug: `northstar-fitness-${sessionId.slice(0, 8)}`,
        contact_person: "Omar Saleh",
        contact_email: "omar@example.test",
        notes: "Always-on social calendar with reels and progress stories.",
        requirements: "High-energy content, fast review cycle, and weekly reporting.",
        assigned_account_manager_id: session.auth_user_id,
        created_by: session.auth_user_id,
        ...marker,
      },
    ])
    .select("id, name");

  const clientRows = (clients as Array<{ id: string; name: string }> | null) ?? [];
  const primaryClientId = clientRows[0]?.id ?? null;
  const secondaryClientId = clientRows[1]?.id ?? primaryClientId;

  const { data: teams } = await admin
    .from("teams")
    .insert([
      {
        company_id: session.company_id,
        name: `Creative Pod ${sessionId.slice(0, 4)}`,
        description: "Demo content, design, and video production squad.",
        status: "active",
        created_by: session.auth_user_id,
        ...marker,
      },
    ])
    .select("id");
  const teamId = teams?.[0]?.id ?? null;

  const { data: tasks } = await admin
    .from("tasks")
    .insert([
      {
        company_id: session.company_id,
        client_id: primaryClientId,
        title: "Draft launch carousel captions",
        description: "Prepare five caption options with CTA variants.",
        assigned_to: session.auth_user_id,
        assigned_by: session.auth_user_id,
        created_by: session.auth_user_id,
        status: "in_progress",
        priority: "high",
        team_id: teamId,
        due_date: inDays(1),
        ...marker,
      },
      {
        company_id: session.company_id,
        client_id: secondaryClientId,
        title: "Submit reel final Drive link",
        description: "Upload the edited vertical reel and thumbnail.",
        assigned_to: session.auth_user_id,
        assigned_by: session.auth_user_id,
        created_by: session.auth_user_id,
        status: "under_review",
        priority: "urgent",
        team_id: teamId,
        due_date: inDays(2),
        final_drive_link: "https://drive.google.com/example-demo-final",
        final_output_submitted_at: new Date().toISOString(),
        final_output_submitted_by: session.auth_user_id,
        ...marker,
      },
    ])
    .select("id");

  const taskId = tasks?.[0]?.id ?? null;
  const { data: ideas } = await admin
    .from("ideas")
    .insert([
      {
        company_id: session.company_id,
        client_id: primaryClientId,
        title: "Before and after skincare routine",
        description: "Educational story sequence for morning routines.",
        created_by: session.auth_user_id,
        assigned_to: session.auth_user_id,
        team_id: teamId,
        status: "submitted",
        idea_type: "story",
        platforms: ["instagram", "tiktok"],
        headline: "Glow starts with the first step",
        subtext: "Simple routine, visible confidence.",
        visual: "Split-screen morning routine sequence.",
        cta: "Save this routine",
        script: "Open with texture shot, then quick application steps.",
        urgency: "normal",
        publishing_at: atDays(4, 9),
        ...marker,
      },
    ])
    .select("id");
  const ideaId = ideas?.[0]?.id ?? null;

  await admin.from("content_items").insert([
    {
      company_id: session.company_id,
      client_id: primaryClientId,
      title: "Aurora launch announcement",
      description: "Hero post for the campaign launch week.",
      creator_id: session.auth_user_id,
      task_id: taskId,
      idea_id: ideaId,
      team_id: teamId,
      status: "sent_to_supervisor",
      submitted_at: new Date().toISOString(),
      scheduled_at: atDays(5, 11),
      ...marker,
    },
    {
      company_id: session.company_id,
      client_id: secondaryClientId,
      title: "Northstar transformation reel",
      description: "Short-form edit with client-approved voiceover.",
      creator_id: session.auth_user_id,
      team_id: teamId,
      status: "scheduled",
      approved_at: new Date().toISOString(),
      scheduled_at: atDays(3, 18),
      final_drive_link: "https://drive.google.com/example-demo-reel",
      final_output_submitted_at: new Date().toISOString(),
      final_output_submitted_by: session.auth_user_id,
      ...marker,
    },
  ]);

  await admin.from("reports").insert([
    {
      company_id: session.company_id,
      client_id: primaryClientId,
      user_id: session.auth_user_id,
      team_id: teamId,
      report_type: "daily",
      title: "Demo daily progress report",
      content: {
        summary: "Campaign captions drafted, reel moved to review, and one idea submitted.",
        blockers: ["Awaiting client decision on launch CTA."],
        role,
      },
      metrics_json: {
        tasks_updated: 2,
        ideas_submitted: 1,
        content_in_review: 1,
      },
      date_range_start: inDays(0),
      date_range_end: inDays(0),
      ...marker,
    },
  ]);

  await admin.from("calendar_events").insert([
    {
      company_id: session.company_id,
      client_id: primaryClientId,
      title: "Aurora launch post scheduled",
      description: "Demo scheduled content item.",
      event_type: "content",
      user_id: session.auth_user_id,
      team_id: teamId,
      start_date: inDays(5),
      end_date: inDays(5),
      created_by: session.auth_user_id,
      ...marker,
    },
    {
      company_id: session.company_id,
      client_id: secondaryClientId,
      title: "Northstar reel review",
      description: "Demo review calendar marker.",
      event_type: "general",
      user_id: session.auth_user_id,
      team_id: teamId,
      start_date: inDays(2),
      end_date: inDays(2),
      created_by: session.auth_user_id,
      ...marker,
    },
  ]);

  await admin.from("notifications").insert([
    {
      company_id: session.company_id,
      user_id: session.auth_user_id,
      title: "Welcome to the Contento demo",
      message: "Use Change role to explore each workspace view. Demo data resets when you end the demo.",
      read: false,
      link_href: "/demo/choose-role",
      ...marker,
    },
  ]);
}
