import type { Metadata } from "next";
import { Palette, Save, Settings } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requirePermission } from "@/lib/auth/context";
import { updateCompanySettingsAction } from "@/lib/settings/actions";
import { getCompanySettings } from "@/lib/settings/queries";
import { CONTENTO_TIME_ZONE, DAILY_BREAK_ALLOWANCE_MINUTES, DEFAULT_WORK_DAY_TARGET_MINUTES } from "@/lib/time";

export const metadata: Metadata = {
  title: "Settings",
};

function settingNumber(settings: unknown, key: string, fallback: number) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return fallback;
  }

  const value = (settings as Record<string, unknown>)[key];
  return typeof value === "number" ? value : fallback;
}

function brandingValue(settings: unknown, key: string, fallback: string) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return fallback;
  }

  const branding = (settings as Record<string, unknown>).branding;

  if (!branding || typeof branding !== "object" || Array.isArray(branding)) {
    return fallback;
  }

  const value = (branding as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : fallback;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("settings.company", "limited");
  const data = await getCompanySettings(context);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Organization settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Configure company identity, branding, work-hour rules, and Cairo timezone defaults.
        </p>
      </div>

      <PageMessage error={params.error} status={params.notice} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="size-4 text-primary" />
            Workspace configuration
          </CardTitle>
          <CardDescription>These settings are company-scoped and applied to the authenticated workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateCompanySettingsAction} className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="companyName">Organization name</Label>
              <Input id="companyName" name="companyName" defaultValue={data.company.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input id="logoUrl" name="logoUrl" defaultValue={data.company.logo_url ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workDayTargetMinutes">Work day target minutes</Label>
              <Input
                id="workDayTargetMinutes"
                name="workDayTargetMinutes"
                type="number"
                min="1"
                defaultValue={settingNumber(data.settings, "workDayTargetMinutes", DEFAULT_WORK_DAY_TARGET_MINUTES)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="breakAllowanceMinutes">Daily break allowance minutes</Label>
              <Input
                id="breakAllowanceMinutes"
                name="breakAllowanceMinutes"
                type="number"
                min="0"
                max="180"
                defaultValue={settingNumber(data.settings, "dailyBreakAllowanceMinutes", DAILY_BREAK_ALLOWANCE_MINUTES)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" name="timezone" defaultValue={CONTENTO_TIME_ZONE} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary color</Label>
              <Input id="primaryColor" name="primaryColor" defaultValue={brandingValue(data.settings, "primaryColor", "#1f8a8a")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondaryColor">Secondary color</Label>
              <Input id="secondaryColor" name="secondaryColor" defaultValue={brandingValue(data.settings, "secondaryColor", "#e9eef2")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accentColor">Accent color</Label>
              <Input id="accentColor" name="accentColor" defaultValue={brandingValue(data.settings, "accentColor", "#d4a72c")} />
            </div>
            <div className="flex items-end lg:col-span-3">
              <Button type="submit">
                <Save />
                Save settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="size-4 text-primary" />
            Branding preview
          </CardTitle>
          <CardDescription>Branding is restrained so dark mode and contrast remain readable.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {(["primaryColor", "secondaryColor", "accentColor"] as const).map((key) => (
              <div key={key} className="rounded-lg border bg-secondary/30 p-3">
                <div
                  className="mb-3 h-10 rounded-md border"
                  style={{ backgroundColor: brandingValue(data.settings, key, "#1f8a8a") }}
                />
                <p className="text-sm font-medium">{key}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
