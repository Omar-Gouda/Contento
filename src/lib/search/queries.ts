import { hasPermission, type AuthContext } from "@/lib/auth/permissions";
import {
  getWorkflowContent,
  getWorkflowIdeas,
  getWorkflowReports,
  getWorkflowTasks,
  getWorkflowTeams,
  getWorkflowUsers,
} from "@/lib/workflows/queries";

export type SearchResult = {
  id: string;
  module: "users" | "teams" | "tasks" | "ideas" | "content" | "reports";
  title: string;
  description: string;
  href: string;
  status?: string;
};

function includesTerm(values: Array<string | null | undefined>, term: string) {
  const normalized = term.toLowerCase();
  return values.some((value) => value?.toLowerCase().includes(normalized));
}

export async function getGlobalSearchResults(context: AuthContext, query: string) {
  const term = query.trim();

  if (!term || !hasPermission(context, "search.global", "view")) {
    return [];
  }

  const [users, teams, tasks, ideas, content, reports] = await Promise.all([
    getWorkflowUsers(context),
    getWorkflowTeams(context),
    getWorkflowTasks(context, { search: term, status: "all" }),
    getWorkflowIdeas(context, { search: term, status: "all" }),
    getWorkflowContent(context, { search: term, status: "all" }),
    getWorkflowReports(context),
  ]);

  const results: SearchResult[] = [];

  for (const user of users) {
    if (includesTerm([user.displayName, user.email, user.roleName], term)) {
      results.push({
        id: user.id,
        module: "users",
        title: user.displayName,
        description: `${user.email} · ${user.roleName}`,
        href: "/admin/users",
        status: user.status,
      });
    }
  }

  for (const team of teams) {
    if (includesTerm([team.name, team.description, team.leadName], term)) {
      results.push({
        id: team.id,
        module: "teams",
        title: team.name,
        description: team.description || `${team.memberCount} members`,
        href: "/team",
        status: team.status,
      });
    }
  }

  for (const task of tasks) {
    results.push({
      id: task.id,
      module: "tasks",
      title: task.title,
      description: task.description || task.assigneeName || "Task",
      href: `/tasks/${task.id}`,
      status: task.status,
    });
  }

  for (const idea of ideas) {
    results.push({
      id: idea.id,
      module: "ideas",
      title: idea.title,
      description: idea.description || idea.assigneeName || "Idea",
      href: `/ideas/${idea.id}`,
      status: idea.status,
    });
  }

  for (const item of content) {
    results.push({
      id: item.id,
      module: "content",
      title: item.title,
      description: item.description || item.creatorName || "Content item",
      href: `/content/${item.id}`,
      status: item.status,
    });
  }

  for (const report of reports) {
    if (includesTerm([report.title, report.report_type, report.userName, report.teamName], term)) {
      results.push({
        id: report.id,
        module: "reports",
        title: report.title,
        description: `${report.report_type} · ${report.userName ?? report.teamName ?? "Report"}`,
        href: `/reports/${report.id}`,
        status: report.report_type,
      });
    }
  }

  return results.slice(0, 50);
}
