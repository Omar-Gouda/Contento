"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Clock,
  FileBarChart,
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
import { getRoleDisplayName, type UserRole } from "@/types/roles";

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

type NavigationGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavigationItem[];
};

const expandedGroupStorageKey = "contento-sidebar-open-group";

const dashboardByRole: Record<UserRole, NavigationItem> = {
  admin: { label: "Marketing Manager dashboard", href: routes.dashboards.marketingManager, icon: LayoutDashboard },
  supervisor: { label: "Account Manager dashboard", href: routes.dashboards.accountManager, icon: LayoutDashboard },
  "team-lead": { label: "Team Lead dashboard", href: routes.dashboards.teamLead, icon: LayoutDashboard },
  creator: { label: "Content Creator dashboard", href: routes.dashboards.contentCreator, icon: LayoutDashboard },
  "graphic-designer": { label: "Graphic Designer dashboard", href: routes.dashboards.graphicDesigner, icon: LayoutDashboard },
  "video-editor": { label: "Video Editor dashboard", href: routes.dashboards.videoEditor, icon: LayoutDashboard },
  client: { label: "Client dashboard", href: routes.dashboards.client, icon: LayoutDashboard },
};

function isActivePath(pathname: string, item: NavigationItem) {
  return pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
}

function getStoredExpandedGroupId() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(expandedGroupStorageKey);
    const parsedValue = rawValue ? JSON.parse(rawValue) : null;

    if (typeof parsedValue === "string") {
      return parsedValue;
    }

    return Array.isArray(parsedValue) && typeof parsedValue[0] === "string" ? parsedValue[0] : null;
  } catch {
    return null;
  }
}

function persistExpandedGroupId(groupId: string | null) {
  if (groupId) {
    window.localStorage.setItem(expandedGroupStorageKey, JSON.stringify(groupId));
    return;
  }

  window.localStorage.removeItem(expandedGroupStorageKey);
}

function NavTooltip({
  label,
  detail,
}: {
  label: string;
  detail?: string;
}) {
  return (
    <span className="pointer-events-none absolute left-12 top-1/2 z-50 hidden min-w-36 -translate-y-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-left text-xs font-medium text-popover-foreground shadow-xl group-hover/nav-item:block group-focus-visible/nav-item:block">
      <span className="block whitespace-nowrap">{label}</span>
      {detail && <span className="mt-0.5 block whitespace-nowrap text-[11px] font-normal text-muted-foreground">{detail}</span>}
    </span>
  );
}

function NavLink({
  item,
  collapsed = false,
  nested = false,
}: {
  item: NavigationItem;
  collapsed?: boolean;
  nested?: boolean;
}) {
  const pathname = usePathname();
  const active = isActivePath(pathname, item);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      className={cn(
        "group/nav-item relative flex h-9 items-center gap-2 rounded-lg text-sm font-medium transition-all duration-200",
        nested ? "px-3 pl-8" : "px-3",
        collapsed && "justify-center px-0",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className={cn("size-4 shrink-0", nested && !collapsed && "size-3.5")} />
      <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
      {active && !collapsed && <span className="ml-auto size-1.5 rounded-full bg-current opacity-80" />}
      {collapsed && <NavTooltip label={item.label} />}
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
    items.push({ label: "Task oversight", href: routes.admin.tasks, icon: ClipboardList });
  }

  if (hasPermission(context, "ideas.review", "full")) {
    items.push({ label: "Idea oversight", href: routes.admin.ideas, icon: Lightbulb });
  }

  if (hasPermission(context, "work_hours.view_company", "view")) {
    items.push({ label: "Work hours", href: routes.admin.workHours, icon: Clock });
  }

  return items;
}

function getClientItems(context: AuthContext): NavigationItem[] {
  const items: NavigationItem[] = [];

  if (hasPermission(context, "clients.view", "view")) {
    items.push({ label: "All clients", href: routes.clients.home, icon: Building2, exact: true });
  }

  return items;
}

function getWorkItems(context: AuthContext): NavigationItem[] {
  const items: NavigationItem[] = [];

  if (hasPermission(context, "tasks.view", "view")) {
    items.push({ label: "Tasks", href: routes.tasks, icon: ClipboardList });
  }

  if (hasPermission(context, "ideas.review", "view")) {
    items.push({ label: "Ideas", href: routes.ideas, icon: Lightbulb });
  }

  if (hasPermission(context, "content.track_pipeline", "view")) {
    items.push({ label: "Content", href: routes.content.home, icon: PanelsTopLeft });
  }

  if (hasPermission(context, "calendar.view", "view")) {
    items.push({ label: "Calendar", href: routes.calendar, icon: CalendarDays });
  }

  return items;
}

function getReviewItems(context: AuthContext): NavigationItem[] {
  const items: NavigationItem[] = [];

  if (hasPermission(context, "ideas.review", "full")) {
    items.push({ label: "Ideas review", href: routes.reviews.ideas, icon: Lightbulb });
  }

  if (hasPermission(context, "reviews.view_submissions", "view")) {
    items.push({ label: "Content review", href: routes.reviews.content, icon: CheckSquare });
  }

  return items;
}

function getReportItems(context: AuthContext): NavigationItem[] {
  const canOpenReports =
    hasPermission(context, "reports.view_company", "view") ||
    hasPermission(context, "reports.view_team", "view") ||
    hasPermission(context, "reports.view_own", "view") ||
    hasPermission(context, "reports.send_to_client", "limited") ||
    hasPermission(context, "reports.submit", "limited");

  if (!canOpenReports) {
    return [];
  }

  return [{ label: "Reports", href: routes.reports, icon: FileBarChart }];
}

function getTeamItems(context: AuthContext): NavigationItem[] {
  const items: NavigationItem[] = [];

  if (hasPermission(context, "teams.view_roster", "view")) {
    items.push({ label: "Team roster", href: routes.team, icon: UsersRound });
  }

  if (context.role === "admin" && hasPermission(context, "teams.view_roster", "view")) {
    items.push({ label: "Manage teams", href: routes.admin.teams, icon: UsersRound });
  }

  return items;
}

function getAccountItems(context: AuthContext): NavigationItem[] {
  const items: NavigationItem[] = [
    { label: "Search", href: routes.search, icon: Search },
    { label: "Profile", href: routes.profile.home, icon: User },
    { label: "My work hours", href: routes.profile.workHours, icon: ShieldCheck },
  ];

  if (hasPermission(context, "settings.company", "limited")) {
    items.push({ label: "Organization settings", href: routes.settings, icon: Settings, exact: true });
  }

  return items;
}

function getNavigationGroups(context: AuthContext): NavigationGroup[] {
  const workspaceItem = {
    ...dashboardByRole[context.role],
    label: `${getRoleDisplayName(context.role)} dashboard`,
  };

  const groups: NavigationGroup[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      items: [workspaceItem],
    },
    {
      id: "clients",
      label: "Clients",
      icon: Building2,
      items: getClientItems(context),
    },
    {
      id: "work",
      label: "Work",
      icon: ClipboardList,
      items: getWorkItems(context),
    },
    {
      id: "reviews",
      label: "Reviews",
      icon: CheckSquare,
      items: getReviewItems(context),
    },
    {
      id: "reports",
      label: "Reports",
      icon: FileBarChart,
      items: getReportItems(context),
    },
    {
      id: "team",
      label: "Team",
      icon: UsersRound,
      items: getTeamItems(context),
    },
    {
      id: "admin",
      label: "Management",
      icon: ShieldCheck,
      items: getAdminItems(context),
    },
    {
      id: "settings",
      label: "Settings",
      icon: User,
      items: getAccountItems(context),
    },
  ];

  return groups.filter((group) => group.items.length > 0);
}

function SidebarGroup({
  group,
  collapsed,
  expanded,
  onToggle,
}: {
  group: NavigationGroup;
  collapsed: boolean;
  expanded: boolean;
  onToggle: (group: NavigationGroup) => void;
}) {
  const pathname = usePathname();
  const GroupIcon = group.icon;
  const active = group.items.some((item) => isActivePath(pathname, item));

  if (collapsed) {
    return (
      <div className="grid gap-1">
        <button
          type="button"
          title={group.label}
          aria-label={group.label}
          aria-expanded={expanded}
          onClick={() => onToggle(group)}
          className={cn(
            "group/nav-item relative flex h-10 items-center justify-center rounded-lg transition-colors",
            active
              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
              : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <GroupIcon className="size-4" />
          {active && <span className="absolute right-1 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-current" />}
          <NavTooltip label={group.label} detail={group.items.map((item) => item.label).join(" / ")} />
        </button>
        {expanded && (
          <div className="grid gap-1 rounded-lg border border-sidebar-border/70 bg-sidebar-accent/30 p-1">
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} collapsed nested />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => onToggle(group)}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <GroupIcon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform duration-200", expanded && "rotate-180")} />
      </button>

      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0">
          <div className="grid gap-1 border-l border-sidebar-border/80 pl-2">
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} nested />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardNavigation({ context, collapsed = false }: { context: AuthContext; collapsed?: boolean }) {
  const pathname = usePathname();
  const groups = useMemo(() => getNavigationGroups(context), [context]);
  const activeRouteGroupId = useMemo(
    () => groups.find((group) => group.items.some((item) => isActivePath(pathname, item)))?.id ?? null,
    [groups, pathname]
  );
  const [openGroupState, setOpenGroupState] = useState<{ groupId: string | null; pathname: string }>(() => {
    const storedGroupId = getStoredExpandedGroupId();
    const validStoredGroupId = groups.some((group) => group.id === storedGroupId) ? storedGroupId : null;

    return {
      groupId: activeRouteGroupId ?? validStoredGroupId ?? groups[0]?.id ?? null,
      pathname,
    };
  });
  const routeChanged = openGroupState.pathname !== pathname;
  const derivedOpenGroupId = routeChanged && activeRouteGroupId ? activeRouteGroupId : openGroupState.groupId;
  const visibleOpenGroupId = derivedOpenGroupId && groups.some((group) => group.id === derivedOpenGroupId)
    ? derivedOpenGroupId
    : activeRouteGroupId ?? groups[0]?.id ?? null;

  function toggleGroup(group: NavigationGroup) {
    setOpenGroupState((current) => {
      const currentOpenGroupId = current.pathname !== pathname && activeRouteGroupId
        ? activeRouteGroupId
        : current.groupId;
      const nextGroupId = currentOpenGroupId === group.id
        ? (group.id === activeRouteGroupId ? group.id : null)
        : group.id;

      persistExpandedGroupId(nextGroupId);

      return {
        groupId: nextGroupId,
        pathname,
      };
    });
  }

  return (
    <nav className={cn("grid gap-2", collapsed && "gap-1.5")}>
      {groups.map((group) => (
        <SidebarGroup
          key={group.id}
          group={group}
          collapsed={collapsed}
          expanded={visibleOpenGroupId === group.id}
          onToggle={toggleGroup}
        />
      ))}
    </nav>
  );
}

export function DashboardMobileBottomNavigation({ context }: { context: AuthContext }) {
  const pathname = usePathname();
  const groups = useMemo(() => getNavigationGroups(context), [context]);
  const items = groups.flatMap((group) => group.items);
  const preferredHrefs = [
    dashboardByRole[context.role].href,
    routes.clients.home,
    routes.tasks,
    routes.ideas,
    routes.calendar,
    routes.reports,
    routes.profile.home,
  ];
  const mobileItems = preferredHrefs
    .map((href) => items.find((item) => item.href === href))
    .filter((item, index, list): item is NavigationItem => item !== undefined && list.findIndex((candidate) => candidate?.href === item.href) === index)
    .slice(0, 5);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-2 py-2 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              <span className="w-full truncate text-center">{item.label.replace(" dashboard", "")}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
