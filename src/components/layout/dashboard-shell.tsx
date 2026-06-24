import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Bell, Building2, Menu, Search, ShieldCheck } from "lucide-react";

import { SignOutButton } from "@/components/forms/sign-out-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { routes } from "@/constants/routes";
import type { AuthContext } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { DashboardNavigation } from "./dashboard-navigation";
import { SiteLogo } from "./site-logo";
import { ThemeToggle } from "./theme-toggle";

export function DashboardShell({
  children,
  context,
  unreadNotificationCount,
  branding,
}: {
  children: ReactNode;
  context: AuthContext;
  unreadNotificationCount?: number;
  branding?: {
    primaryColor: string | null;
    secondaryColor: string | null;
    accentColor: string | null;
  } | null;
}) {
  const brandingStyle = {
    ...(branding?.primaryColor ? { "--primary": branding.primaryColor, "--sidebar-primary": branding.primaryColor } : {}),
    ...(branding?.secondaryColor ? { "--secondary": branding.secondaryColor, "--sidebar-accent": branding.secondaryColor } : {}),
    ...(branding?.accentColor ? { "--accent": branding.accentColor } : {}),
  } as CSSProperties;

  return (
    <div className="min-h-svh bg-background" style={brandingStyle}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex lg:flex-col">
        <div className="px-2">
          <SiteLogo />
        </div>
        <Separator className="my-5" />
        <DashboardNavigation context={context} />
        <div className="mt-auto rounded-lg border border-sidebar-border bg-background/70 p-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-primary" />
            Active workspace
          </div>
          <p className="mt-2 truncate text-xs text-muted-foreground">{context.email}</p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <details className="group relative lg:hidden">
              <summary className={cn(buttonVariants({ variant: "outline", size: "icon" }), "list-none")}>
                <Menu />
                <span className="sr-only">Open navigation</span>
              </summary>
              <div className="absolute left-0 top-11 w-72 rounded-lg border bg-popover p-3 shadow-xl">
                <DashboardNavigation context={context} />
              </div>
            </details>

            <div className="hidden min-w-0 items-center gap-3 lg:flex">
              <div className="flex size-9 items-center justify-center rounded-lg border bg-secondary text-primary">
                <Building2 className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">Contento workspace</p>
                <p className="truncate text-xs text-muted-foreground">
                  {context.roleName} access
                </p>
              </div>
            </div>

            <Link
              href={routes.search}
              className="hidden w-full max-w-md items-center gap-2 rounded-lg border bg-secondary/45 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary md:flex"
            >
              <Search className="size-4" />
              Search company-scoped records
            </Link>

            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <Link
                href={routes.notifications}
                className={cn(buttonVariants({ variant: "outline", size: "icon" }), "relative")}
                aria-label="Notifications"
              >
                <Bell />
                {Boolean(unreadNotificationCount) && (
                  <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {unreadNotificationCount}
                  </span>
                )}
              </Link>
              <div className="hidden sm:block">
                <SignOutButton />
              </div>
              <Button type="button" variant="outline" size="icon" aria-label="Security status">
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
