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
  { label: "Marketing Manager", href: routes.dashboards.marketingManager },
  { label: "Account Manager", href: routes.dashboards.accountManager },
  { label: "Team Lead", href: routes.dashboards.teamLead },
  { label: "Content Creator", href: routes.dashboards.contentCreator },
  { label: "Graphic Designer", href: routes.dashboards.graphicDesigner },
  { label: "Video Editor", href: routes.dashboards.videoEditor },
  { label: "Client", href: routes.dashboards.client },
];

export const roleDashboards: Record<RoleDashboard["role"], RoleDashboard> = {
  admin: {
    role: "admin",
    title: "Marketing Manager dashboard",
    eyebrow: "Company control center",
    description:
      "A clear command view for clients, teams, approvals, reports, and the work that needs a decision today.",
    primaryFocus: [
      "Manage clients and users",
      "Monitor delivery health",
      "Approve high-impact work",
    ],
    category: "leadership",
  },
  supervisor: {
    role: "supervisor",
    title: "Account Manager dashboard",
    eyebrow: "Client delivery",
    description:
      "Client portfolios, briefs, deadlines, handoffs, and approval signals stay visible without making the day noisy.",
    primaryFocus: [
      "Own client relationships",
      "Route work to production",
      "Keep timelines moving",
    ],
    category: "operations",
  },
  "team-lead": {
    role: "team-lead",
    title: "Team Lead dashboard",
    eyebrow: "Daily team workflow",
    description:
      "Task assignment, team content pipeline, daily progress, calendar, and team reports will be managed here.",
    primaryFocus: [
      "Assign creator tasks",
      "Track daily progress",
      "Escalate workflow issues",
    ],
    category: "operations",
  },
  creator: {
    role: "creator",
    title: "Content Creator dashboard",
    eyebrow: "Personal workbench",
    description:
      "Your assigned ideas, captions, scripts, content submissions, and delivery dates in one focused workbench.",
    primaryFocus: [
      "Submit ideas and content",
      "Update task status",
      "Review personal performance",
    ],
    category: "production",
  },
  "graphic-designer": {
    role: "graphic-designer",
    title: "Graphic Designer dashboard",
    eyebrow: "Visual production",
    description:
      "Design tasks, final artwork links, deadlines, and review requests stay organized around each client.",
    primaryFocus: [
      "Deliver visual assets",
      "Attach final Drive links",
      "Track design revisions",
    ],
    category: "production",
  },
  "video-editor": {
    role: "video-editor",
    title: "Video Editor dashboard",
    eyebrow: "Video production",
    description:
      "Editing assignments, final video links, deadlines, and review handoffs are kept close to the client brief.",
    primaryFocus: [
      "Deliver final edits",
      "Attach video Drive links",
      "Track review handoffs",
    ],
    category: "production",
  },
  client: {
    role: "client",
    title: "Client dashboard",
    eyebrow: "Brand review",
    description:
      "Review assigned ideas, scheduled content, reports, and client-facing delivery updates for your brand.",
    primaryFocus: [
      "Review ideas and content",
      "Follow publishing dates",
      "Read client reports",
    ],
    category: "client",
  },
};
