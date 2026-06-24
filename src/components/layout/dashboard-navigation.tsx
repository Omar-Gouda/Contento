"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Bell,
  ClipboardList,
  Clock,
  FileBarChart,
  FileText,
  LayoutDashboard,
  Lightbulb,
  PanelsTopLeft,
  Search,
  Settings,
  ShieldCheck,
  User,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { routes } from "@/constants/routes";
import { hasPermission, type AuthContext } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/roles";

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const dashboardByRole: Record<UserRole, NavigationItem> = {
  admin: { label: "Admin dashboard", href: routes.dashboards.admin, icon: LayoutDashboard },
  supervisor: { label: "Supervisor dashboard", href: routes.dashboards.supervisor, icon: LayoutDashboard },
  "team-lead": { label: "Team Lead dashboard", href: routes.dashboards.teamLead, icon: LayoutDashboard },
  creator: { label: "Creator dashboard", href: routes.dashboards.creator, icon: LayoutDashboard },
};

function NavLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

function getAdminItems(context: AuthContext): NavigationItem[] {
  if (context.role !== "admin") {
    return [];
  }

  const items: NavigationItem[] = [];

  if (hasPermission(context, "users.view_activity", "view")) {
    items.push({ label: "Users", href: routes.admin.users, icon: Users });
  }

  if (hasPermission(context, "teams.view_roster", "view")) {
    items.push({ label: "Teams", href: routes.admin.teams, icon: UsersRound });
  }

  if (hasPermission(context, "tasks.view", "full")) {
    items.push({ label: "Tasks", href: routes.admin.tasks, icon: ClipboardList });
  }

  if (hasPermission(context, "ideas.review", "full")) {
    items.push({ label: "Ideas", href: routes.admin.ideas, icon: Lightbulb });
  }

  if (hasPermission(context, "work_hours.view_company", "view")) {
    items.push({ label: "Work hours", href: routes.admin.workHours, icon: Clock });
  }

  return items;
}

function getOperationItems(context: AuthContext): NavigationItem[] {
  const items: NavigationItem[] = [];

  if (hasPermission(context, "teams.view_roster", "view")) {
    items.push({ label: "Team", href: routes.team, icon: UsersRound });
  }

  if (hasPermission(context, "tasks.view", "view")) {
    items.push({ label: "Tasks", href: routes.tasks, icon: ClipboardList });
  }

  if (hasPermission(context, "ideas.review", "view")) {
    items.push({ label: "Ideas", href: routes.ideas, icon: Lightbulb });
  }

  if (hasPermission(context, "content.track_pipeline", "view")) {
    items.push({ label: "Content", href: routes.content.home, icon: PanelsTopLeft });
  }

  if (hasPermission(context, "reviews.view_submissions", "view")) {
    items.push({ label: "Reviews", href: routes.content.reviews, icon: FileText });
  }

  if (hasPermission(context, "content.templates.use", "view")) {
    items.push({ label: "Templates", href: routes.content.templates, icon: FileText });
  }

  if (hasPermission(context, "calendar.view", "view")) {
    items.push({ label: "Calendar", href: routes.calendar, icon: CalendarDays });
  }

  if (hasPermission(context, "reports.view_own", "view")) {
    items.push({ label: "Reports", href: routes.reports, icon: FileBarChart });
  }

  return items;
}

export function DashboardNavigation({ context }: { context: AuthContext }) {
  const workspaceItem = dashboardByRole[context.role];
  const workspaceItems = workspaceItem ? [workspaceItem] : [];
  const operationItems = getOperationItems(context);
  const adminItems = getAdminItems(context);
  const accountItems: NavigationItem[] = [
    { label: "Search", href: routes.search, icon: Search },
    { label: "Notifications", href: routes.notifications, icon: Bell },
    { label: "Profile", href: routes.profile.home, icon: User },
    { label: "Work hours", href: routes.profile.workHours, icon: ShieldCheck },
  ];

  if (hasPermission(context, "settings.company", "limited")) {
    accountItems.push({ label: "Settings", href: routes.settings, icon: Settings });
  }


  return (
    <nav className="space-y-6">
      <div className="space-y-2">
        <p className="px-3 text-xs font-medium uppercase tracking-[0.16em] text-sidebar-foreground/50">
          Workspace
        </p>
        <div className="grid gap-1">
          {workspaceItems.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
          ))}
        </div>

      </div>

      {operationItems.length > 0 && (
        <div className="space-y-2">
          <p className="px-3 text-xs font-medium uppercase tracking-[0.16em] text-sidebar-foreground/50">
            Operations
          </p>
          <div className="grid gap-1">
            {operationItems.map((item) => (
              <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
            ))}
          </div>
        </div>
      )}

      {adminItems.length > 0 && (
        <div className="space-y-2">
          <p className="px-3 text-xs font-medium uppercase tracking-[0.16em] text-sidebar-foreground/50">
            Admin
          </p>
          <div className="grid gap-1">
            {adminItems.map((item) => (
              <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="px-3 text-xs font-medium uppercase tracking-[0.16em] text-sidebar-foreground/50">
          Account
        </p>
        <div className="grid gap-1">
          {accountItems.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
          ))}
        </div>
      </div>
    </nav>
  );
}
