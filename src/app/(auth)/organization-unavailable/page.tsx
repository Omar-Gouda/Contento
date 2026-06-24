import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { SignOutButton } from "@/components/forms/sign-out-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { resolveAuthProfile } from "@/lib/auth/context";
import { getRedirectPathForAuthResolution } from "@/lib/auth/route-access";

export const metadata: Metadata = {
  title: "Organization unavailable",
};

export default async function OrganizationUnavailablePage() {
  const resolution = await resolveAuthProfile();
  const redirectPath = getRedirectPathForAuthResolution(routes.organizationUnavailable, resolution);

  if (redirectPath) {
    redirect(redirectPath);
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Organization unavailable</CardTitle>
        <CardDescription>
          This workspace is no longer available in Contento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Workspace access closed</AlertTitle>
          <AlertDescription>
            The organization has been removed from active service. Contact your Contento platform administrator.
          </AlertDescription>
        </Alert>
        <SignOutButton />
      </CardContent>
    </Card>
  );
}
