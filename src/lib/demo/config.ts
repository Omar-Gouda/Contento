import type { UserRole } from "@/types/roles";

export const DEMO_EMAIL = "demo@contento.app";
export const DEMO_PASSWORD = "ContentoDemo@2026";
export const DEMO_COMPANY_NAME = "Contento Demo Workspace";
export const DEMO_COMPANY_SLUG = "contento-demo-workspace";
export const DEMO_SESSION_COOKIE = "contento-demo-session-id";
export const DEMO_ROLE_COOKIE = "contento-demo-role";
export const DEMO_TTL_MINUTES = 45;

export const demoRoles: Array<{
  role: UserRole;
  title: string;
  description: string;
}> = [
  {
    role: "admin",
    title: "Marketing Manager",
    description: "Full workspace overview, users, clients, reports, and approvals.",
  },
  {
    role: "supervisor",
    title: "Account Manager",
    description: "Assigned clients, task review, reports, and client coordination.",
  },
  {
    role: "creator",
    title: "Content Creator",
    description: "Assigned tasks, ideas, content creation, and personal reports.",
  },
  {
    role: "graphic-designer",
    title: "Graphic Designer",
    description: "Production queue, final Drive links, and revision tracking.",
  },
  {
    role: "video-editor",
    title: "Video Editor",
    description: "Video and reel production queue with final submissions.",
  },
  {
    role: "client",
    title: "Client",
    description: "Client portal view for calendar, feedback, and sent reports.",
  },
];

export function isDemoCredential(email: string, password: string) {
  return email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD;
}

export function getDemoRoleConfig(role: UserRole) {
  return demoRoles.find((demoRole) => demoRole.role === role) ?? null;
}
