export const routes = {
  home: "/",
  signIn: "/sign-in",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  changePassword: "/change-password",
  onboarding: "/onboarding",
  accountInactive: "/account-inactive",
  profile: {
    workHours: "/profile/work-hours",
  },
  team: "/team",
  tasks: "/tasks",
  ideas: "/ideas",
  content: {
    home: "/content",
    reviews: "/content/reviews",
  },
  calendar: "/calendar",
  reports: "/reports",
  admin: {
    users: "/admin/users",
    invitations: "/admin/invitations",
    teams: "/admin/teams",
    tasks: "/admin/tasks",
    ideas: "/admin/ideas",
    workHours: "/admin/work-hours",
  },
  superiorAdmin: {
    home: "/super-admin",
    organizations: "/super-admin/organizations",
  },
  dashboards: {
    admin: "/admin",
    supervisor: "/supervisor",
    teamLead: "/team-lead",
    creator: "/creator",
  },
} as const;
