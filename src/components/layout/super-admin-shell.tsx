"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  HeartPulse,
  LayoutDashboard,
  Menu,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  ShieldCheck,
  ShieldX,
  TicketCheck,
  type LucideIcon,
} from "lucide-react";

import { SignOutButton } from "@/components/forms/sign-out-button";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { SiteLogo } from "./site-logo";
import { ThemeToggle } from "./theme-toggle";

type PlatformItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

type PlatformGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: PlatformItem[];
};

const collapsedStorageKey = "contento-super-admin-sidebar-collapsed";
const expandedStorageKey = "contento-super-admin-sidebar-open-group";

const platformGroups: PlatformGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [{ label: "Platform overview", href: routes.superiorAdmin.home, icon: LayoutDashboard, exact: true }],
  },
  {
    id: "organizations",
    label: "Organizations",
    icon: Building2,
    items: [
      { label: "All organizations", href: routes.superiorAdmin.organizations, icon: Building2 },
      { label: "Organization requests", href: routes.superiorAdmin.organizationRequests, icon: ClipboardCheck },
      { label: "Billing", href: routes.superiorAdmin.billing, icon: CreditCard },
      { label: "Trial blacklist", href: routes.superiorAdmin.trialBlacklist, icon: ShieldX },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: TicketCheck,
    items: [
      { label: "Support inbox", href: routes.superiorAdmin.support, icon: TicketCheck },
      { label: "Announcements", href: routes.superiorAdmin.announcements, icon: Megaphone },
      { label: "Audit logs", href: routes.superiorAdmin.auditLogs, icon: ScrollText },
      { label: "System health", href: routes.superiorAdmin.systemHealth, icon: HeartPulse },
    ],
  },
];

function isActivePath(pathname: string, item: PlatformItem) {
  return pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
}

function getStoredExpandedGroups() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(expandedStorageKey);
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
    window.localStorage.setItem(expandedStorageKey, JSON.stringify(groupId));
    return;
  }

  window.localStorage.removeItem(expandedStorageKey);
}

function NavTooltip({ label, detail }: { label: string; detail?: string }) {
  return (
    <span className="pointer-events-none absolute left-12 top-1/2 z-50 hidden min-w-36 -translate-y-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-left text-xs font-medium text-popover-foreground shadow-xl group-hover/nav-item:block group-focus-visible/nav-item:block">
      <span className="block whitespace-nowrap">{label}</span>
      {detail && <span className="mt-0.5 block whitespace-nowrap text-[11px] font-normal text-muted-foreground">{detail}</span>}
    </span>
  );
}

function PlatformNavLink({
  item,
  collapsed = false,
  nested = false,
}: {
  item: PlatformItem;
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
        "group/nav-item relative flex h-9 items-center gap-2 rounded-lg text-sm font-medium transition-colors",
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

function SuperAdminNavigation({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const activeGroupIds = useMemo(
    () => platformGroups.filter((group) => group.items.some((item) => isActivePath(pathname, item))).map((group) => group.id),
    [pathname]
  );
  const activeRouteGroupId = activeGroupIds[0] ?? null;
  const [openGroupState, setOpenGroupState] = useState<{ groupId: string | null; pathname: string }>(() => {
    const storedGroupId = getStoredExpandedGroups();
    const validStoredGroupId = platformGroups.some((group) => group.id === storedGroupId) ? storedGroupId : null;

    return {
      groupId: activeRouteGroupId ?? validStoredGroupId ?? platformGroups[0]?.id ?? null,
      pathname,
    };
  });
  const derivedOpenGroupId = openGroupState.pathname !== pathname && activeRouteGroupId
    ? activeRouteGroupId
    : openGroupState.groupId;
  const visibleOpenGroupId = derivedOpenGroupId && platformGroups.some((group) => group.id === derivedOpenGroupId)
    ? derivedOpenGroupId
    : activeRouteGroupId;

  function toggleGroup(group: PlatformGroup) {
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
      {platformGroups.map((group) => {
        const GroupIcon = group.icon;
        const expanded = visibleOpenGroupId === group.id;
        const active = group.items.some((item) => isActivePath(pathname, item));

        if (collapsed) {
          return (
            <div key={group.id} className="grid gap-1">
              <button
                type="button"
                title={group.label}
                aria-label={group.label}
                aria-expanded={expanded}
                onClick={() => toggleGroup(group)}
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
                    <PlatformNavLink key={item.href} item={item} collapsed nested />
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <div key={group.id} className="space-y-1.5">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => toggleGroup(group)}
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
                    <PlatformNavLink key={item.href} item={item} nested />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function SuperAdminShell({
  children,
  email,
}: {
  children: ReactNode;
  email: string;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(collapsedStorageKey) === "true";
  });

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(collapsedStorageKey, String(next));
      return next;
    });
  }

  return (
    <div className="min-h-svh bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-sidebar-border bg-sidebar px-4 py-5 transition-[width] duration-300 ease-out lg:flex lg:flex-col",
          sidebarCollapsed ? "w-20" : "w-72"
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-2">
          <div className="min-w-0">
            <SiteLogo showText={!sidebarCollapsed} />
            {!sidebarCollapsed && (
              <p className="mt-1 truncate pl-10 text-xs text-sidebar-foreground/55">
                Platform console
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>
        <Separator className="my-5" />
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
          <SuperAdminNavigation collapsed={sidebarCollapsed} />
        </div>
        <div className="mt-5 shrink-0 space-y-3">
          <div
            className={cn(
              "rounded-lg border border-sidebar-border bg-background/70 p-3 shadow-sm",
              sidebarCollapsed && "flex justify-center p-2"
            )}
            title={email}
          >
            <div className={cn("flex items-center gap-2 text-sm font-medium", sidebarCollapsed && "justify-center")}>
              <ShieldCheck className="size-4 text-primary" />
              {!sidebarCollapsed && "Super Admin"}
            </div>
            {!sidebarCollapsed && <p className="mt-2 truncate text-xs text-muted-foreground">{email}</p>}
          </div>
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-sidebar-border bg-background/70 p-2 shadow-sm">
              <ThemeToggle />
              <SignOutButton />
            </div>
          )}
        </div>
      </aside>

      <div className={cn("transition-[padding] duration-300 ease-out", sidebarCollapsed ? "lg:pl-20" : "lg:pl-72")}>
        <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Sheet>
              <SheetTrigger
                render={
                  <Button type="button" variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation" />
                }
              >
                <Menu />
              </SheetTrigger>
              <SheetContent side="left" className="w-[20rem] gap-0 p-0 sm:max-w-[20rem]">
                <SheetHeader className="border-b px-4 py-4">
                  <SheetTitle>
                    <SiteLogo />
                  </SheetTitle>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                  <SuperAdminNavigation />
                </div>
                <div className="border-t p-4">
                  <div className="mb-3 rounded-lg border bg-secondary/40 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ShieldCheck className="size-4 text-primary" />
                      Super Admin
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ThemeToggle />
                    <SignOutButton />
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <div className="hidden min-w-0 items-center gap-3 lg:flex">
              <div className="flex size-9 items-center justify-center rounded-lg border bg-secondary text-primary">
                <ShieldCheck className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">Contento platform</p>
                <p className="truncate text-xs text-muted-foreground">Super Admin access</p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="hidden lg:block">
                <ThemeToggle />
              </div>
              <div className="hidden sm:block">
                <SignOutButton />
              </div>
              <Button type="button" variant="outline" size="icon" aria-label="Platform security status">
                <ShieldCheck />
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
