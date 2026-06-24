import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { SiteLogo } from "./site-logo";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="hidden border-r bg-secondary/45 p-8 lg:flex lg:flex-col lg:justify-between">
        <SiteLogo />
        <div className="max-w-md space-y-6">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Contento access
          </p>
          <h1 className="text-4xl font-semibold tracking-normal text-foreground">
            A focused workspace for every content role.
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            Secure access is handled through Supabase Auth, company profiles, active account checks, and role-based dashboard routing.
          </p>
        </div>
        <Link
          href={routes.home}
          className={cn(buttonVariants({ variant: "ghost" }), "w-fit")}
        >
          <ArrowLeft />
          Back to home
        </Link>
      </aside>
      <section className="flex min-h-svh flex-col">
        <div className="flex h-16 items-center justify-between border-b px-4 lg:hidden">
          <SiteLogo />
          <Link href={routes.home} className={buttonVariants({ variant: "ghost" })}>
            Home
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          {children}
        </div>
      </section>
    </main>
  );
}
