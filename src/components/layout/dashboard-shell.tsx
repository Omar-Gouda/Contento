"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react";

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
import type { AuthContext } from "@/lib/auth/permissions";
import type { OrganizationChatData } from "@/lib/chat/queries";
import type { NotificationRow } from "@/lib/notifications/queries";
import type { NotificationPreferences } from "@/lib/settings/queries";
import type { CurrentWorkHours } from "@/lib/work-hours/queries";
import { cn } from "@/lib/utils";
import { getRoleDisplayName } from "@/types/roles";
import { DashboardMobileBottomNavigation, DashboardNavigation } from "./dashboard-navigation";
import { NotificationMenu } from "./notification-menu";
import { OrganizationChatDrawer } from "./organization-chat-drawer";
import { CompactThemeToggle, ThemeToggle } from "./theme-toggle";
import { WorkHoursStatusMenu } from "./work-hours-status-menu";

export function DashboardShell({
  children,
  context,
  unreadNotificationCount,
  recentNotifications = [],
  notificationPreferences,
  chatData,
  branding,
  workHours,
}: {
  children: ReactNode;
  context: AuthContext;
  unreadNotificationCount?: number;
  recentNotifications?: NotificationRow[];
  notificationPreferences?: NotificationPreferences;
  chatData?: OrganizationChatData;
  workHours?: CurrentWorkHours | null;
  branding?: {
    companyName?: string | null;
    logoUrl?: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    accentColor: string | null;
  } | null;
}) {
  const contentoMarkSrc = "/brand/contento-mark.svg";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("contento-sidebar-collapsed") === "true";
  });
  const brandingStyle = {
    ...(branding?.primaryColor ? { "--primary": branding.primaryColor, "--sidebar-primary": branding.primaryColor } : {}),
    ...(branding?.secondaryColor ? { "--secondary": branding.secondaryColor, "--sidebar-accent": branding.secondaryColor } : {}),
    ...(branding?.accentColor ? { "--accent": branding.accentColor } : {}),
  } as CSSProperties;
  const organizationName = branding?.companyName ?? "Workspace";

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("contento-sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <div className="min-h-svh bg-background" style={brandingStyle}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-sidebar-border bg-sidebar px-4 py-5 transition-[width] duration-300 ease-out lg:flex lg:flex-col",
          sidebarCollapsed ? "w-20" : "w-72"
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-2">
          <div className={cn("flex min-w-0 items-center gap-2", sidebarCollapsed && "justify-center")}>
            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-primary/10 text-sm font-semibold text-primary">
              {branding?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt="" className="size-full object-cover object-center" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={contentoMarkSrc} alt="" className="size-full object-cover object-center" />
              )}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">{organizationName}</p>
                <p className="truncate text-xs text-sidebar-foreground/55">Contento</p>
              </div>
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
          <DashboardNavigation context={context} collapsed={sidebarCollapsed} />
        </div>
        <div className="mt-5 shrink-0 space-y-3">
          <div
            className={cn(
              "rounded-lg border border-sidebar-border bg-background/70 p-3 shadow-sm",
              sidebarCollapsed && "flex justify-center p-2"
            )}
            title={context.email}
          >
            <div className={cn("flex items-center gap-2 text-sm font-medium", sidebarCollapsed && "justify-center")}>
              <ShieldCheck className="size-4 text-primary" />
              {!sidebarCollapsed && "Active workspace"}
            </div>
            {!sidebarCollapsed && <p className="mt-2 truncate text-xs text-muted-foreground">{context.email}</p>}
          </div>
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
                  <SheetTitle className="flex items-center gap-2">
                    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-primary/10 text-sm font-semibold text-primary">
                      {branding?.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={branding.logoUrl} alt="" className="size-full object-cover object-center" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={contentoMarkSrc} alt="" className="size-full object-cover object-center" />
                      )}
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block truncate text-sm font-semibold">{organizationName}</span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">Contento</span>
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                  <DashboardNavigation context={context} />
                </div>
                <div className="border-t p-4">
                  <div className="mb-3 rounded-lg border bg-secondary/40 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ShieldCheck className="size-4 text-primary" />
                      {getRoleDisplayName(context.role)} access
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{context.email}</p>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <div className="hidden min-w-0 items-center gap-3 lg:flex">
              <div className="flex size-9 items-center justify-center overflow-hidden rounded-lg border bg-primary/10 text-primary">
                {branding?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={branding.logoUrl} alt="" className="size-full object-cover object-center" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={contentoMarkSrc} alt="" className="size-full object-cover object-center" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{branding?.companyName ?? "Contento workspace"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {getRoleDisplayName(context.role)} access
                </p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="sm:hidden">
                <CompactThemeToggle />
              </div>
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>
              <NotificationMenu
                unreadCount={unreadNotificationCount ?? 0}
                notifications={recentNotifications}
                userId={context.userId}
                companyId={context.companyId}
                initialSoundEnabled={notificationPreferences?.sound ?? true}
                initialDesktopEnabled={notificationPreferences?.desktop ?? false}
              />
              {workHours !== undefined && <WorkHoursStatusMenu workHours={workHours} />}
              <OrganizationChatDrawer
                data={chatData ?? { conversations: [], recipients: [] }}
                currentUserId={context.userId}
                companyId={context.companyId}
              />
              <div className="hidden sm:block">
                <SignOutButton
                  hasActiveWorkSession={Boolean(workHours?.activeWorkSession)}
                  hasActiveBreak={Boolean(workHours?.activeBreakSession)}
                />
              </div>
              <div className="sm:hidden">
                <SignOutButton
                  compact
                  hasActiveWorkSession={Boolean(workHours?.activeWorkSession)}
                  hasActiveBreak={Boolean(workHours?.activeBreakSession)}
                />
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-6">
          {children}
        </main>
      </div>
      <DashboardMobileBottomNavigation context={context} />
    </div>
  );
}
