"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowDown, BarChart3, ChevronUp, Rocket, Sparkles, UsersRound } from "lucide-react";

import { routes } from "@/constants/routes";
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
  const pathname = usePathname();

  if (pathname === routes.signIn) {
    return <SignInLockScreen>{children}</SignInLockScreen>;
  }

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

function SignInLockScreen({ children }: { children: ReactNode }) {
  const startY = useRef(0);
  const startTime = useRef(0);
  const dragDistanceRef = useRef(0);
  const pointerId = useRef<number | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragProgress, setDragProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const threshold = 72;
  const fastSwipeVelocity = 0.52;
  const maxDrag = 170;
  const heroTransform = unlocked ? "translate3d(0, -100%, 0)" : `translate3d(0, ${dragOffset}px, 0)`;
  const contentOpacity = unlocked ? 0 : Math.max(0.42, 1 - dragProgress * 0.72);
  const contentLift = unlocked ? "-40px" : `${dragOffset * 0.16}px`;
  const transitionClass = useMemo(
    () => reducedMotion || dragging
      ? "transition-none"
      : "transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
    [dragging, reducedMotion]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (!unlocked) {
      return;
    }

    const timeout = window.setTimeout(() => {
      document.getElementById("email")?.focus();
    }, reducedMotion ? 0 : 420);

    return () => window.clearTimeout(timeout);
  }, [reducedMotion, unlocked]);

  function revealForm() {
    setDragging(false);
    setDragOffset(0);
    setDragProgress(0);
    dragDistanceRef.current = 0;
    setUnlocked(true);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (unlocked) {
      return;
    }

    pointerId.current = event.pointerId;
    startY.current = event.clientY;
    startTime.current = performance.now();
    dragDistanceRef.current = 0;
    setDragProgress(0);
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (!dragging || pointerId.current !== event.pointerId || unlocked) {
      return;
    }

    const upwardDistance = Math.max(startY.current - event.clientY, 0);
    const downwardResistance = Math.max(event.clientY - startY.current, 0) * 0.12;
    dragDistanceRef.current = upwardDistance;
    setDragProgress(Math.min(upwardDistance / maxDrag, 1));
    setDragOffset(upwardDistance > 0 ? -Math.min(upwardDistance, maxDrag) : Math.min(downwardResistance, 18));
  }

  function finishDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!dragging || pointerId.current !== event.pointerId) {
      return;
    }

    const elapsed = Math.max(performance.now() - startTime.current, 1);
    const velocity = dragDistanceRef.current / elapsed;
    const shouldUnlock = dragDistanceRef.current >= threshold || (dragDistanceRef.current >= 28 && velocity >= fastSwipeVelocity);
    pointerId.current = null;
    setDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (shouldUnlock) {
      revealForm();
      return;
    }

    setDragOffset(0);
    setDragProgress(0);
    dragDistanceRef.current = 0;
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-background">
      <section
        id="auth-form"
        className="relative z-0 flex min-h-[100svh] items-center justify-center px-4 py-12"
      >
        <div
          aria-hidden={!unlocked}
          className={cn(
            "w-full max-w-md",
            reducedMotion
              ? "transition-none"
              : "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
            unlocked
              ? "translate-y-0 opacity-100 delay-150"
              : "pointer-events-none translate-y-8 opacity-0"
          )}
        >
          {children}
        </div>
      </section>

      <section
        aria-label="Welcome"
        className={cn(
          "absolute inset-0 z-10 touch-none overflow-hidden bg-background will-change-transform",
          dragging ? "cursor-grabbing" : "cursor-grab",
          transitionClass
        )}
        style={{ transform: heroTransform }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,color-mix(in_oklch,var(--primary),transparent_70%),transparent_34%),radial-gradient(circle_at_82%_78%,color-mix(in_oklch,var(--accent),transparent_62%),transparent_30%),linear-gradient(135deg,var(--background),var(--secondary))]" />
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-8 sm:py-5">
          <SiteLogo />
          <div className="rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            Contento
          </div>
        </div>

        <div
          className={cn(
            "relative z-10 mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col items-center justify-center px-4 pb-6 pt-20 text-center sm:px-5 sm:py-24",
            transitionClass
          )}
          style={{
            opacity: contentOpacity,
            transform: `translate3d(0, ${contentLift}, 0)`,
          }}
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-primary shadow-sm backdrop-blur sm:mb-5 sm:text-sm">
            <Sparkles className="size-4" />
            Content operations, unlocked
          </div>
          <h1 className="max-w-4xl text-3xl font-semibold leading-tight tracking-normal text-foreground sm:text-6xl sm:leading-[1.02] lg:text-7xl">
            Because great ideas deserve better than sticky notes.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:mt-6 sm:text-lg sm:leading-8">
            Plan content, manage clients, review ideas, and keep every campaign moving.
          </p>

          <div className="mt-5 grid w-full max-w-3xl grid-cols-3 gap-2 sm:mt-10 sm:gap-3">
            {heroStats.map((stat) => (
              <div key={stat.label} className="rounded-xl border bg-background/70 px-2 py-3 shadow-sm backdrop-blur sm:rounded-2xl sm:px-4 sm:py-4">
                <p className="text-lg font-semibold sm:text-2xl">{stat.value}</p>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground sm:text-xs">{stat.label}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={revealForm}
            className="mt-6 inline-flex items-center gap-3 rounded-full border bg-background/80 px-4 py-2.5 text-sm font-semibold shadow-xl backdrop-blur transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:mt-12 sm:px-5 sm:py-3"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground sm:size-8">
              <ChevronUp className="size-4 animate-bounce motion-reduce:animate-none" />
            </span>
            Swipe up to continue
          </button>

          <div className="mt-8 hidden flex-col items-center gap-2 text-muted-foreground sm:flex">
            <div className="h-16 w-px rounded-full bg-gradient-to-b from-transparent via-current to-transparent opacity-50" />
            <ChevronUp className="size-5 animate-bounce opacity-70 motion-reduce:animate-none" />
          </div>
        </div>
      </section>
    </main>
  );
}
