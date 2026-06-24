import { routes } from "@/constants/routes";
import type { RoleDashboard } from "@/types/roles";

export const siteConfig = {
  name: "Contento",
  description:
    "Content operations, approvals, reports, schedules, analytics, and role dashboards for multi-company teams.",
  navItems: [
    { label: "Workflow", href: "#workflow" },
    { label: "Roles", href: "#roles" },
    { label: "Foundation", href: "#foundation" },
  ],
};

export const dashboardNavItems = [
  { label: "Admin", href: routes.dashboards.admin },
  { label: "Supervisor", href: routes.dashboards.supervisor },
  { label: "CC Team Lead", href: routes.dashboards.teamLead },
  { label: "Creator", href: routes.dashboards.creator },
];

export const roleDashboards: Record<RoleDashboard["role"], RoleDashboard> = {
  admin: {
    role: "admin",
    title: "Admin dashboard",
    eyebrow: "Company control center",
    description:
      "Workspace, user, analytics, reports, exports, settings, and audit-log surfaces will live here.",
    primaryFocus: [
      "Manage users and roles",
      "Monitor activity logs",
      "Review analytics and exports",
    ],
  },
  supervisor: {
    role: "supervisor",
    title: "Supervisor dashboard",
    eyebrow: "Approvals and performance",
    description:
      "Team performance, pending reviews, feedback, reports, and activity monitoring will be organized here.",
    primaryFocus: [
      "Review creator submissions",
      "Approve or return content",
      "Track reports and team activity",
    ],
  },
  "team-lead": {
    role: "team-lead",
    title: "CC Team Lead dashboard",
    eyebrow: "Daily team workflow",
    description:
      "Task assignment, team content pipeline, daily progress, calendar, and team reports will be managed here.",
    primaryFocus: [
      "Assign creator tasks",
      "Track daily progress",
      "Escalate workflow issues",
    ],
  },
  creator: {
    role: "creator",
    title: "Creator dashboard",
    eyebrow: "Personal workbench",
    description:
      "Assigned tasks, ideas, submissions, calendar, personal reports, and performance surfaces will live here.",
    primaryFocus: [
      "Submit ideas and content",
      "Update task status",
      "Review personal performance",
    ],
  },
};
