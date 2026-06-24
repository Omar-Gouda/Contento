import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { SiteLogo } from "./site-logo";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <SiteLogo />
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {siteConfig.navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href={routes.signIn}
            className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}
          >
            Sign in
          </Link>
          <Link href={routes.dashboards.admin} className={buttonVariants()}>
            View app
          </Link>
        </div>
      </div>
    </header>
  );
}
