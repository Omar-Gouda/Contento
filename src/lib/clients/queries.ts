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
  const [{ data: users, error: usersError }, { data: roles, error: rolesError }] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, first_name, last_name, role_id, status")
      .eq("company_id", context.companyId)
      .order("first_name", { ascending: true }),
    supabase
      .from("roles")
      .select("id, name")
      .eq("company_id", context.companyId),
  ]);

  if (usersError || rolesError) {
    throw new Error("Unable to load assignable users.");
  }

  const roleById = new Map(((roles as RoleRow[] | null) ?? []).map((role) => [role.id, role.name]));

  return ((users as UserRow[] | null) ?? []).map((user) => {
    const roleName = user.role_id ? roleById.get(user.role_id) ?? "Unassigned" : "Unassigned";

    return {
      ...user,
      displayName: fullName(user),
      roleName: getRoleDisplayName(roleName),
      roleKey: normalizeRoleName(roleName),
    };
  });
}

export async function getClients(
  context: AuthContext,
  filters: { search?: string; status?: string } = {}
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

  const [{ data: clients, error }, users] = await Promise.all([
    query,
    getClientAssignableUsers(context),
  ]);

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

  const userById = new Map(users.map((user) => [user.id, user]));
  const assignmentRows = (assignments as ClientAssignmentRow[] | null) ?? [];

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
