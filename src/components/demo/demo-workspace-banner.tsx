"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronDown, Circle, HelpCircle, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";

import { signOutAction } from "@/lib/auth/actions";
import { resetDemoSessionAction } from "@/lib/demo/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { OrganizationRequestWizard } from "@/components/demo/organization-request-wizard";
import type { AuthContext } from "@/lib/auth/permissions";
import { getRoleDisplayName, type UserRole } from "@/types/roles";

type DemoStep = {
  id: string;
  label: string;
  match?: (pathname: string) => boolean;
  notices?: string[];
};

const progressEventName = "contento-demo-progress-updated";

const dashboardPaths = [
  "/marketing-manager",
  "/account-manager",
  "/content-creator",
  "/graphic-designer",
  "/video-editor",
  "/client",
  "/admin",
  "/supervisor",
  "/creator",
];

function includesAny(value: string, fragments: string[]) {
  return fragments.some((fragment) => value.includes(fragment));
}

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const roleChecklists: Record<UserRole, DemoStep[]> = {
  admin: [
    { id: "role", label: "Choose Marketing Manager role" },
    { id: "dashboard", label: "Visit dashboard", match: (pathname) => dashboardPaths.includes(pathname) },
    { id: "clients", label: "Explore clients", match: (pathname) => startsWithAny(pathname, ["/clients"]) },
    { id: "client-profile", label: "Open a client profile", match: (pathname) => /^\/clients\/[^/]+/.test(pathname) },
    { id: "team", label: "Review users or team", match: (pathname) => startsWithAny(pathname, ["/admin/users", "/admin/teams", "/users", "/team"]) },
    { id: "reviews", label: "Visit approvals or reviews", match: (pathname) => startsWithAny(pathname, ["/reviews", "/content/reviews"]) },
    { id: "reports", label: "Generate or view reports", match: (pathname) => startsWithAny(pathname, ["/reports"]), notices: ["report"] },
    { id: "calendar", label: "Visit calendar", match: (pathname) => startsWithAny(pathname, ["/calendar"]), notices: ["time off"] },
  ],
  supervisor: [
    { id: "role", label: "Choose Account Manager role" },
    { id: "dashboard", label: "Visit dashboard", match: (pathname) => dashboardPaths.includes(pathname) },
    { id: "clients", label: "Explore assigned clients", match: (pathname) => startsWithAny(pathname, ["/clients"]) },
    { id: "tasks", label: "Review tasks", match: (pathname) => startsWithAny(pathname, ["/tasks", "/admin/tasks"]), notices: ["task"] },
    { id: "reports", label: "Generate or view reports", match: (pathname) => startsWithAny(pathname, ["/reports"]), notices: ["report"] },
    { id: "calendar", label: "Visit calendar", match: (pathname) => startsWithAny(pathname, ["/calendar"]), notices: ["time off"] },
  ],
  "team-lead": [
    { id: "role", label: "Choose Team Lead role" },
    { id: "dashboard", label: "Visit dashboard", match: (pathname) => dashboardPaths.includes(pathname) },
    { id: "tasks", label: "Review team tasks", match: (pathname) => startsWithAny(pathname, ["/tasks", "/admin/tasks"]), notices: ["task"] },
    { id: "reviews", label: "Visit reviews", match: (pathname) => startsWithAny(pathname, ["/reviews", "/content/reviews"]) },
    { id: "team", label: "Check team view", match: (pathname) => startsWithAny(pathname, ["/team", "/admin/teams"]) },
    { id: "reports", label: "Review reports", match: (pathname) => startsWithAny(pathname, ["/reports"]), notices: ["report"] },
  ],
  creator: [
    { id: "role", label: "Choose Content Creator role" },
    { id: "dashboard", label: "Visit dashboard", match: (pathname) => dashboardPaths.includes(pathname) },
    { id: "tasks", label: "Open tasks", match: (pathname) => startsWithAny(pathname, ["/tasks"]), notices: ["task"] },
    { id: "ideas", label: "Create or review ideas", match: (pathname) => startsWithAny(pathname, ["/ideas", "/reviews/ideas"]), notices: ["idea"] },
    { id: "content", label: "Explore content or reviews", match: (pathname) => startsWithAny(pathname, ["/content", "/reviews/content"]), notices: ["content", "review"] },
    { id: "reports", label: "Generate a report", match: (pathname) => startsWithAny(pathname, ["/reports"]), notices: ["report"] },
    { id: "profile", label: "Visit profile", match: (pathname) => startsWithAny(pathname, ["/profile"]) },
  ],
  "graphic-designer": [
    { id: "role", label: "Choose Graphic Designer role" },
    { id: "dashboard", label: "Visit dashboard", match: (pathname) => dashboardPaths.includes(pathname) },
    { id: "tasks", label: "Open production tasks", match: (pathname) => startsWithAny(pathname, ["/tasks"]), notices: ["task"] },
    { id: "final-output", label: "Submit or inspect final output", match: (pathname) => startsWithAny(pathname, ["/tasks", "/content"]), notices: ["final output", "drive link"] },
    { id: "content", label: "Explore content workflow", match: (pathname) => startsWithAny(pathname, ["/content", "/reviews/content"]) },
    { id: "reports", label: "Generate a report", match: (pathname) => startsWithAny(pathname, ["/reports"]), notices: ["report"] },
  ],
  "video-editor": [
    { id: "role", label: "Choose Video Editor role" },
    { id: "dashboard", label: "Visit dashboard", match: (pathname) => dashboardPaths.includes(pathname) },
    { id: "tasks", label: "Open video or reel tasks", match: (pathname) => startsWithAny(pathname, ["/tasks"]), notices: ["task"] },
    { id: "final-output", label: "Submit or inspect final output", match: (pathname) => startsWithAny(pathname, ["/tasks", "/content"]), notices: ["final output", "drive link"] },
    { id: "content", label: "Explore content workflow", match: (pathname) => startsWithAny(pathname, ["/content", "/reviews/content"]) },
    { id: "reports", label: "Generate a report", match: (pathname) => startsWithAny(pathname, ["/reports"]), notices: ["report"] },
  ],
  client: [
    { id: "role", label: "Choose Client role" },
    { id: "dashboard", label: "Visit client portal", match: (pathname) => dashboardPaths.includes(pathname) },
    { id: "calendar", label: "Review calendar", match: (pathname) => startsWithAny(pathname, ["/calendar"]) },
    { id: "ideas", label: "Review idea feedback", match: (pathname) => startsWithAny(pathname, ["/ideas", "/reviews/ideas"]), notices: ["idea"] },
    { id: "reports", label: "View sent reports", match: (pathname) => startsWithAny(pathname, ["/reports"]), notices: ["report"] },
  ],
};

function pageGuide(pathname: string, roleName: string) {
  if (pathname.startsWith("/clients")) {
    return {
      title: "Clients",
      body: `${roleName} can explore client workspaces, briefs, linked work, and demo contract context. Real client data is never shown here.`,
    };
  }

  if (pathname.startsWith("/tasks")) {
    return {
      title: "Tasks",
      body: `${roleName} sees task work according to the selected demo role. Writes stay inside the temporary demo workspace.`,
    };
  }

  if (pathname.startsWith("/ideas")) {
    return {
      title: "Ideas",
      body: `${roleName} can inspect the idea workflow, review states, and publishing context using sandbox data.`,
    };
  }

  if (pathname.startsWith("/content") || pathname.startsWith("/reviews")) {
    return {
      title: "Content and reviews",
      body: `${roleName} can follow submissions, approvals, feedback, and final handoff examples for the selected role.`,
    };
  }

  if (pathname.startsWith("/reports")) {
    return {
      title: "Reports",
      body: `${roleName} can review generated report examples from demo activity. Sending real emails is disabled for demo use.`,
    };
  }

  if (pathname.startsWith("/calendar")) {
    return {
      title: "Calendar",
      body: `${roleName} sees scheduling examples for task deadlines, publishing dates, and time-off visibility in Cairo time.`,
    };
  }

  if (pathname.startsWith("/admin/users") || pathname.startsWith("/users")) {
    return {
      title: "Users",
      body: `${roleName} can view the user-management experience where permitted. Demo actions never affect production users.`,
    };
  }

  if (pathname.startsWith("/profile") || pathname.startsWith("/settings")) {
    return {
      title: "Profile and settings",
      body: `${roleName} can inspect account and workspace settings safely. Demo uploads and organization settings are disabled.`,
    };
  }

  return {
    title: "Dashboard",
    body: `${roleName} is viewing a role-scoped dashboard with temporary clients, work, reports, notifications, and calendar data.`,
  };
}

function storagePrefix(sessionId: string | null | undefined) {
  return `contento-demo-progress:${sessionId ?? "session"}`;
}

function clearDemoProgress(sessionId: string | null | undefined) {
  if (typeof window === "undefined") {
    return;
  }

  const prefix = storagePrefix(sessionId);
  for (const key of Object.keys(window.sessionStorage)) {
    if (key.startsWith(prefix)) {
      window.sessionStorage.removeItem(key);
    }
  }

  window.dispatchEvent(new Event(progressEventName));
}

function readStoredProgress(snapshot: string, validStepIds: Set<string>) {
  try {
    const stored = JSON.parse(snapshot || "[]");
    const storedIds = Array.isArray(stored) ? stored.filter((id): id is string => validStepIds.has(id)) : [];
    return new Set(["role", ...storedIds]);
  } catch {
    return new Set(["role"]);
  }
}

function subscribeDemoProgress(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(progressEventName, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(progressEventName, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getStoredProgressSnapshot(storageKey: string) {
  if (typeof window === "undefined") {
    return "[]";
  }

  return window.sessionStorage.getItem(storageKey) ?? "[]";
}

function serializeProgress(completed: Set<string>) {
  return JSON.stringify(Array.from(completed).sort());
}

export function DemoWorkspaceBanner({ context }: { context: AuthContext }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const roleName = getRoleDisplayName(context.role);
  const guide = useMemo(() => pageGuide(pathname, roleName), [pathname, roleName]);
  const checklist = useMemo(() => roleChecklists[context.role], [context.role]);
  const validStepIds = useMemo(() => new Set(checklist.map((item) => item.id)), [checklist]);
  const storageKey = `${storagePrefix(context.demoSessionId)}:${context.role}`;
  const seenKey = `contento-demo-guide:${context.demoSessionId ?? "session"}:${context.role}:${pathname}`;
  const notice = searchParams.get("notice") ?? "";
  const storedProgressSnapshot = useSyncExternalStore(
    subscribeDemoProgress,
    () => getStoredProgressSnapshot(storageKey),
    () => "[]"
  );
  const completed = useMemo(() => {
    const noticeText = notice.toLowerCase();
    const next = readStoredProgress(storedProgressSnapshot, validStepIds);

    next.add("role");
    for (const step of checklist) {
      if (step.match?.(pathname)) {
        next.add(step.id);
      }

      if (step.notices && includesAny(noticeText, step.notices)) {
        next.add(step.id);
      }
    }

    return next;
  }, [checklist, notice, pathname, storedProgressSnapshot, validStepIds]);
  const serializedProgress = useMemo(() => serializeProgress(completed), [completed]);
  const progress = Math.round((completed.size / checklist.length) * 100);
  const ctaReady = progress >= 80;

  useEffect(() => {
    if (typeof window === "undefined" || storedProgressSnapshot === serializedProgress) {
      return;
    }

    window.sessionStorage.setItem(storageKey, serializedProgress);
    window.dispatchEvent(new Event(progressEventName));
  }, [serializedProgress, storageKey, storedProgressSnapshot]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!window.sessionStorage.getItem(seenKey)) {
      window.sessionStorage.setItem(seenKey, "true");
      const timeout = window.setTimeout(() => setOpen(true), 0);

      return () => window.clearTimeout(timeout);
    }
  }, [seenKey]);

  useEffect(() => {
    function cleanup() {
      navigator.sendBeacon?.("/api/demo/cleanup");
    }

    window.addEventListener("pagehide", cleanup);

    return () => window.removeEventListener("pagehide", cleanup);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <section className="mb-6 rounded-2xl border border-primary/25 bg-primary/10 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">You are viewing a temporary demo workspace.</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Data resets after sign out. Current role: <span className="font-medium text-foreground">{roleName}</span>.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(true)}>
              <HelpCircle />
              What can I do here?
            </Button>
            <form action={resetDemoSessionAction} onSubmit={() => clearDemoProgress(context.demoSessionId)}>
              <Button type="submit" variant="outline">
                <RefreshCw />
                Reset demo
              </Button>
            </form>
            <Link href="/demo/choose-role" className={buttonVariants({ variant: "outline" })}>
              Change role
            </Link>
            <form action={signOutAction} onSubmit={() => clearDemoProgress(context.demoSessionId)}>
              <Button type="submit">End demo</Button>
            </form>
          </div>
        </div>
      </section>

      <section className="mb-6 overflow-hidden rounded-3xl border border-primary/25 bg-card p-5 text-card-foreground shadow-xl sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" />
              Demo progress {progress}%
            </span>
            <h2 className="mt-4 max-w-2xl text-2xl font-semibold tracking-normal sm:text-3xl">
              {ctaReady ? "Ready to build your own organization?" : "Explore Contento with guided sandbox progress."}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              {ctaReady
                ? "You have explored enough of the sandbox to request a real Contento workspace."
                : "Try role-scoped pages and safe actions. Progress updates as you visit routes or complete demo workflow actions."}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {ctaReady && (
                <Button type="button" onClick={() => setRequestOpen(true)}>
                  Create my organization
                  <ArrowRight />
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setOpen(true)}>
                Learn more
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Demo checklist</p>
                <p className="mt-1 text-xs text-muted-foreground">Role explored: {roleName}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {completed.size}/{checklist.length}
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <button
              type="button"
              className="mt-4 flex w-full items-center justify-between rounded-xl border bg-background px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-muted"
              onClick={() => setChecklistOpen((value) => !value)}
              aria-expanded={checklistOpen}
            >
              Checklist details
              <ChevronDown className={`size-4 transition ${checklistOpen ? "rotate-180" : ""}`} />
            </button>
            {checklistOpen && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {checklist.map((item) => {
                  const done = completed.has(item.id);

                  return (
                    <div key={item.id} className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm">
                      {done ? (
                        <CheckCircle2 className="size-4 text-primary" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground" />
                      )}
                      <span className={done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {requestOpen && <OrganizationRequestWizard open={requestOpen} onOpenChange={setRequestOpen} />}

      {open && (
        <div
          className="fixed inset-0 z-[999] grid place-items-center bg-background/80 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-guide-title"
            className="relative w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl"
          >
            <button
              type="button"
              aria-label="Close demo guide"
              className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </button>
            <p className="text-sm font-medium text-primary">Demo guide</p>
            <h2 id="demo-guide-title" className="mt-2 text-2xl font-semibold">
              {guide.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{guide.body}</p>
            <p className="mt-4 rounded-xl border bg-secondary/40 p-3 text-sm leading-6 text-muted-foreground">
              Disabled in demo mode: production data access, super-admin actions, real email sends, hard deletes, billing, and secrets.
            </p>
            <Button type="button" className="mt-6 w-full" onClick={() => setOpen(false)}>
              Got it
            </Button>
          </section>
        </div>
      )}
    </>
  );
}
