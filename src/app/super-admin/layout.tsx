import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

import { SignOutButton } from "@/components/forms/sign-out-button";
import { SiteLogo } from "@/components/layout/site-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { requireSuperiorAdminContext } from "@/lib/auth/context";

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const context = await requireSuperiorAdminContext();

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <SiteLogo />
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border bg-secondary/60 px-3 py-1.5 text-sm text-muted-foreground sm:flex">
              <ShieldCheck className="size-4 text-primary" />
              {context.email}
            </div>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
