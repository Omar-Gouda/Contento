import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { selectDemoRoleAction } from "@/lib/demo/actions";
import { demoRoles } from "@/lib/demo/config";
import { resolveAuthProfile } from "@/lib/auth/context";
import { getDefaultDashboardPath } from "@/types/roles";

export const metadata: Metadata = {
  title: "Choose demo role",
};

export default async function DemoChooseRolePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const resolution = await resolveAuthProfile();
  const params = await searchParams;

  if (resolution.state === "unauthenticated") {
    redirect("/sign-in");
  }

  if (resolution.state !== "active" && resolution.state !== "demo_needs_role") {
    redirect("/sign-in");
  }

  if (resolution.state === "active" && !resolution.context.isDemo) {
    redirect(getDefaultDashboardPath(resolution.context.role));
  }

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.24),transparent_34%),linear-gradient(135deg,var(--background),var(--secondary))] px-4 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex items-center gap-3">
          <span className="flex size-12 overflow-hidden rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/contento-mark.svg" alt="" className="size-full object-cover" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-[0.14em]">contento</p>
            <p className="text-xs font-medium text-primary">Public demo workspace</p>
          </div>
        </div>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-sm font-medium text-primary shadow-sm backdrop-blur">
              <ShieldCheck className="size-4" />
              Temporary sandbox
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">
              Choose how you want to experience Contento.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Each role changes the dashboard, navigation, permissions, and page guidance for this browser session only.
              Demo data is isolated and resets when you end the demo.
            </p>
          </div>
          <Card className="bg-background/75 shadow-xl backdrop-blur">
            <CardHeader>
              <CardTitle>Demo safety</CardTitle>
              <CardDescription>
                The public demo cannot access real organizations, secrets, super-admin actions, or production user data.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-start gap-3 text-sm text-muted-foreground">
              <RefreshCw className="mt-0.5 size-4 shrink-0 text-primary" />
              Data expires automatically after a short session and is cleaned up on sign out.
            </CardContent>
          </Card>
        </section>

        {params?.error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Demo role could not be selected. Try another role.
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {demoRoles.map((demoRole) => (
            <Card key={demoRole.role} className="bg-background/78 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl">
              <CardHeader>
                <CardTitle>{demoRole.title}</CardTitle>
                <CardDescription>{demoRole.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={selectDemoRoleAction}>
                  <input type="hidden" name="role" value={demoRole.role} />
                  <Button type="submit" className="w-full">
                    Try as this role
                    <ArrowRight />
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
