import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";
import { getWorkflowContent, getWorkflowIdeas, getWorkflowReports, getWorkflowTasks } from "@/lib/workflows/queries";
import type { Database } from "@/types/database";
import { getRoleDisplayName, normalizeRoleName } from "@/types/roles";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type ClientAssignmentRow = Database["public"]["Tables"]["client_assignments"]["Row"];
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type UserRow = Pick<
  Database["public"]["Tables"]["users"]["Row"],
  "id" | "email" | "first_name" | "last_name" | "role_id" | "status"
>;
type RoleRow = Pick<Database["public"]["Tables"]["roles"]["Row"], "id" | "name">;
type SupabaseQueryError = {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

export type ClientUser = UserRow & {
  displayName: string;
  roleName: string;
  roleKey: ReturnType<typeof normalizeRoleName>;
  teamIds: string[];
};

export type ClientProfile = ClientRow & {
  logoSignedUrl: string | null;
  accountManagerName: string | null;
  assignedUsers: Array<ClientUser & { assignmentRole: ClientAssignmentRow["assignment_role"] }>;
};

export type ClientWorkspace = ClientProfile & {
  tasks: Awaited<ReturnType<typeof getWorkflowTasks>>;
  ideas: Awaited<ReturnType<typeof getWorkflowIdeas>>;
  content: Awaited<ReturnType<typeof getWorkflowContent>>;
  reports: Awaited<ReturnType<typeof getWorkflowReports>>;
};

export type ClientWorkspaceSignal = {
  clientId: string;
  openTaskCount: number;
  openIdeaCount: number;
  upcomingPublishingAt: string | null;
};

function fullName(user: Pick<UserRow, "first_name" | "last_name" | "email"> | null | undefined) {
  if (!user) {
    return "";
  }

  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return name || user.email;
}

function clientSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

function logGetClientsError(error: SupabaseQueryError) {
  console.error("getClients error", {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

async function getSignedLogoUrl(supabase: SupabaseServerClient, logoPath: string | null) {
  if (!logoPath) {
    return null;
  }

  if (logoPath.startsWith("http://") || logoPath.startsWith("https://")) {
    return logoPath;
  }

  const { data } = await supabase.storage
    .from("contento-avatars")
    .createSignedUrl(logoPath, 60 * 60);

  return data?.signedUrl ?? null;
}

export async function getClientAssignableUsers(context: AuthContext): Promise<ClientUser[]> {
  const supabase = await createSupabaseServerClient();
  const [
    { data: users, error: usersError },
    { data: roles, error: rolesError },
    { data: teamMemberships, error: teamMembershipsError },
  ] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, first_name, last_name, role_id, status")
      .eq("company_id", context.companyId)
      .order("first_name", { ascending: true }),
    supabase
      .from("roles")
      .select("id, name")
      .eq("company_id", context.companyId),
    supabase
      .from("team_members")
      .select("team_id, user_id"),
  ]);

  if (usersError || rolesError || teamMembershipsError) {
    throw new Error("Unable to load assignable users.");
  }

  const roleById = new Map(((roles as RoleRow[] | null) ?? []).map((role) => [role.id, role.name]));
  const teamIdsByUserId = new Map<string, string[]>();

  ((teamMemberships as Array<{ team_id: string; user_id: string }> | null) ?? []).forEach((membership) => {
    const teamIds = teamIdsByUserId.get(membership.user_id) ?? [];
    teamIds.push(membership.team_id);
    teamIdsByUserId.set(membership.user_id, teamIds);
  });

  return ((users as UserRow[] | null) ?? []).map((user) => {
    const roleName = user.role_id ? roleById.get(user.role_id) ?? "Unassigned" : "Unassigned";

    return {
      ...user,
      displayName: fullName(user),
      roleName: getRoleDisplayName(roleName),
      roleKey: normalizeRoleName(roleName),
      teamIds: teamIdsByUserId.get(user.id) ?? [],
    };
  });
}

async function getClientUsersByIds(context: AuthContext, userIds: string[]): Promise<ClientUser[]> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  if (!uniqueUserIds.length) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const [
    { data: users, error: usersError },
    { data: roles, error: rolesError },
    { data: teamMemberships, error: teamMembershipsError },
  ] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, first_name, last_name, role_id, status")
      .eq("company_id", context.companyId)
      .in("id", uniqueUserIds),
    supabase
      .from("roles")
      .select("id, name")
      .eq("company_id", context.companyId),
    supabase
      .from("team_members")
      .select("team_id, user_id")
      .in("user_id", uniqueUserIds),
  ]);

  if (usersError || rolesError || teamMembershipsError) {
    throw new Error("Unable to load assigned users.");
  }

  const roleById = new Map(((roles as RoleRow[] | null) ?? []).map((role) => [role.id, role.name]));
  const teamIdsByUserId = new Map<string, string[]>();

  ((teamMemberships as Array<{ team_id: string; user_id: string }> | null) ?? []).forEach((membership) => {
    const teamIds = teamIdsByUserId.get(membership.user_id) ?? [];
    teamIds.push(membership.team_id);
    teamIdsByUserId.set(membership.user_id, teamIds);
  });

  return ((users as UserRow[] | null) ?? []).map((user) => {
    const roleName = user.role_id ? roleById.get(user.role_id) ?? "Unassigned" : "Unassigned";

    return {
      ...user,
      displayName: fullName(user),
      roleName: getRoleDisplayName(roleName),
      roleKey: normalizeRoleName(roleName),
      teamIds: teamIdsByUserId.get(user.id) ?? [],
    };
  });
}

export async function getClients(
  context: AuthContext,
  filters: { search?: string; status?: string; limit?: number } = {}
): Promise<ClientProfile[]> {
  const supabase = await createSupabaseServerClient();
  await supabase.rpc("expire_current_company_clients", {});
  let query = supabase
    .from("clients")
    .select("id, company_id, name, slug, logo_url, primary_color, secondary_color, accent_color, contact_person, contact_email, contact_phone, notes, brief_drive_link, requirements, assigned_account_manager_id, contract_start_date, contract_end_date, disabled_at, disabled_reason, status, created_by, created_at, updated_at")
    .eq("company_id", context.companyId)
    .order("updated_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status as ClientRow["status"]);
  }

  if (context.role === "client") {
    query = query.eq("status", "active");
  }

  if (filters.search) {
    query = query.ilike("name", `%${filters.search.trim()}%`);
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data: clients, error } = await query;

  if (error) {
    logGetClientsError(error);
    throw new Error("Unable to load clients.");
  }

  const clientRows = (clients as ClientRow[] | null) ?? [];
  const clientIds = clientRows.map((client) => client.id);
  const { data: assignments, error: assignmentsError } = clientIds.length
    ? await supabase
      .from("client_assignments")
      .select("client_id, user_id, assignment_role, created_at")
      .in("client_id", clientIds)
    : { data: [], error: null };

  if (assignmentsError) {
    throw new Error("Unable to load client assignments.");
  }

  const assignmentRows = (assignments as ClientAssignmentRow[] | null) ?? [];
  const users = await getClientUsersByIds(context, [
    ...(clientRows.map((client) => client.assigned_account_manager_id).filter(Boolean) as string[]),
    ...assignmentRows.map((assignment) => assignment.user_id),
  ]);
  const userById = new Map(users.map((user) => [user.id, user]));

  return Promise.all(clientRows.map(async (client) => ({
    ...client,
    logoSignedUrl: await getSignedLogoUrl(supabase, client.logo_url),
    accountManagerName: client.assigned_account_manager_id
      ? userById.get(client.assigned_account_manager_id)?.displayName ?? null
      : null,
    assignedUsers: assignmentRows
      .filter((assignment) => assignment.client_id === client.id)
      .map((assignment) => {
        const user = userById.get(assignment.user_id);
        return user ? { ...user, assignmentRole: assignment.assignment_role } : null;
      })
      .filter((user): user is ClientUser & { assignmentRole: ClientAssignmentRow["assignment_role"] } => Boolean(user)),
  })));
}

export async function getClientWorkspaceSignals(context: AuthContext, clientIds: string[]) {
  const uniqueClientIds = Array.from(new Set(clientIds.filter(Boolean)));

  if (!uniqueClientIds.length) {
    return new Map<string, ClientWorkspaceSignal>();
  }

  const supabase = await createSupabaseServerClient();
  const [
    { data: tasks, error: tasksError },
    { data: ideas, error: ideasError },
    { data: content, error: contentError },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("client_id, status")
      .eq("company_id", context.companyId)
      .in("client_id", uniqueClientIds),
    supabase
      .from("ideas")
      .select("client_id, status, publishing_at")
      .eq("company_id", context.companyId)
      .in("client_id", uniqueClientIds),
    supabase
      .from("content_items")
      .select("client_id, scheduled_at")
      .eq("company_id", context.companyId)
      .in("client_id", uniqueClientIds),
  ]);

  if (tasksError || ideasError || contentError) {
    throw new Error("Unable to load client workspace signals.");
  }

  const signals = new Map<string, ClientWorkspaceSignal>(
    uniqueClientIds.map((clientId) => [
      clientId,
      {
        clientId,
        openTaskCount: 0,
        openIdeaCount: 0,
        upcomingPublishingAt: null,
      },
    ])
  );
  const now = Date.now();

  function setNearestDate(clientId: string | null, value: string | null) {
    if (!clientId || !value) {
      return;
    }

    const signal = signals.get(clientId);
    const candidateTime = new Date(value).getTime();

    if (!signal || !Number.isFinite(candidateTime) || candidateTime < now) {
      return;
    }

    const currentTime = signal.upcomingPublishingAt
      ? new Date(signal.upcomingPublishingAt).getTime()
      : Number.POSITIVE_INFINITY;

    if (candidateTime < currentTime) {
      signal.upcomingPublishingAt = value;
    }
  }

  ((tasks as Array<{ client_id: string | null; status: string }> | null) ?? []).forEach((task) => {
    if (!task.client_id || ["completed", "closed"].includes(task.status)) {
      return;
    }

    const signal = signals.get(task.client_id);
    if (signal) {
      signal.openTaskCount += 1;
    }
  });

  ((ideas as Array<{ client_id: string | null; status: string; publishing_at: string | null }> | null) ?? []).forEach((idea) => {
    if (idea.client_id && !["approved", "rejected", "archived"].includes(idea.status)) {
      const signal = signals.get(idea.client_id);
      if (signal) {
        signal.openIdeaCount += 1;
      }
    }

    setNearestDate(idea.client_id, idea.publishing_at);
  });

  ((content as Array<{ client_id: string | null; scheduled_at: string | null }> | null) ?? []).forEach((item) => {
    setNearestDate(item.client_id, item.scheduled_at);
  });

  return signals;
}

export async function getClientById(context: AuthContext, clientId: string) {
  const clients = await getClients(context);
  return clients.find((client) => client.id === clientId) ?? null;
}

export async function getClientWorkspace(context: AuthContext, clientId: string): Promise<ClientWorkspace | null> {
  const client = await getClientById(context, clientId);

  if (!client) {
    return null;
  }

  const [tasks, ideas, content, reports] = await Promise.all([
    getWorkflowTasks(context, { clientId }),
    getWorkflowIdeas(context, { clientId }),
    getWorkflowContent(context, { clientId }),
    getWorkflowReports(context, { clientId }),
  ]);

  return {
    ...client,
    tasks,
    ideas,
    content,
    reports,
  };
}

export function suggestedClientSlug(name: string) {
  return clientSlug(name);
}
