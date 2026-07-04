import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Ban } from "lucide-react";

import { SignOutButton } from "@/components/forms/sign-out-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { resolveAuthProfile } from "@/lib/auth/context";
import { getRedirectPathForAuthResolution } from "@/lib/auth/route-access";

export const metadata: Metadata = {
  title: "Organization disabled",
};

export default async function OrganizationDisabledPage() {
  const resolution = await resolveAuthProfile();
  const redirectPath = getRedirectPathForAuthResolution(routes.organizationDisabled, resolution);

  if (redirectPath) {
    redirect(redirectPath);
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <span className="mb-2 flex size-12 overflow-hidden rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/contento-mark.svg" alt="" className="size-full object-cover" />
        </span>
        <CardTitle>Organization disabled</CardTitle>
        <CardDescription>
          This workspace is currently disabled by a Contento platform administrator.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert variant="destructive">
          <Ban className="size-4" />
          <AlertTitle>Workspace access paused</AlertTitle>
          <AlertDescription>
            Dashboard access is blocked until the organization is reactivated.
          </AlertDescription>
        </Alert>
        <SignOutButton />
      </CardContent>
    </Card>
  );
}
