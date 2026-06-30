import type { ReactNode } from "react";
import { ArrowDown, BarChart3, Rocket, Sparkles, UsersRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { SiteLogo } from "./site-logo";

const heroStats = [
  { label: "Campaign velocity", value: "+38%" },
  { label: "Review clarity", value: "4.8x" },
  { label: "Team visibility", value: "Live" },
];

const heroCards = [
  {
    icon: BarChart3,
    title: "Sharper priorities",
    description: "Turn scattered content work into a clear operating rhythm.",
  },
  {
    icon: UsersRound,
    title: "Aligned teams",
    description: "Bring creators, leads, and reviewers into one shared flow.",
  },
  {
    icon: Rocket,
    title: "Room to grow",
    description: "Scale content operations without losing momentum.",
  },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-svh scroll-smooth bg-background">
      <section className="relative flex min-h-svh overflow-hidden border-b bg-[radial-gradient(circle_at_20%_20%,color-mix(in_oklch,var(--primary),transparent_72%),transparent_32%),linear-gradient(135deg,var(--background),var(--secondary))]">
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 py-5 sm:px-8">
          <SiteLogo />
          <a
            href="#auth-form"
            className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background/70 px-3 text-sm font-medium shadow-sm backdrop-blur transition-colors hover:bg-background"
          >
            Sign in
            <ArrowDown className="size-4" />
          </a>
        </div>

        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 py-24 sm:px-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="max-w-2xl pt-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-sm font-medium text-primary shadow-sm backdrop-blur">
              <Sparkles className="size-4" />
              Because great ideas deserve better than sticky notes.
            </div>
            <h1 className="text-5xl font-semibold leading-[1.02] tracking-normal text-foreground sm:text-6xl">
              Grow the work without losing the thread.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Contento helps busy teams keep priorities visible, collaboration steady, and publishing momentum clear from idea to delivery.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {heroStats.map((stat) => (
                <div key={stat.label} className="rounded-xl border bg-background/70 px-4 py-3 shadow-sm backdrop-blur">
                  <p className="text-2xl font-semibold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border bg-background/75 p-4 shadow-2xl backdrop-blur">
              <div className="grid gap-3">
                {heroCards.map((card, index) => {
                  const Icon = card.icon;

                  return (
                    <div
                      key={card.title}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border bg-secondary/45 p-4",
                        index === 1 && "ml-6",
                        index === 2 && "ml-12"
                      )}
                    >
                      <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <p className="font-medium">{card.title}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{card.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <a
              href="#auth-form"
              className="mx-auto inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur transition-colors hover:bg-background"
            >
              Continue to sign in
              <ArrowDown className="size-4" />
            </a>
          </div>
        </div>
      </section>

      <section id="auth-form" className="flex min-h-svh items-center justify-center px-4 py-12">
        {children}
      </section>
    </main>
  );
}
