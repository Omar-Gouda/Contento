import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { SignOutButton } from "@/components/forms/sign-out-button";
import { routes } from "@/constants/routes";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resolveAuthProfile } from "@/lib/auth/context";
import { getRedirectPathForAuthResolution } from "@/lib/auth/route-access";

export const metadata: Metadata = {
  title: "Account inactive",
};

function statusLabel(status: string) {
  if (status === "invited") {
    return "invited";
  }

  if (status === "suspended") {
    return "suspended";
  }

  if (status === "disabled") {
    return "disabled";
  }

  return "unavailable";
}

export default async function AccountInactivePage() {
  const resolution = await resolveAuthProfile();
  const redirectPath = getRedirectPathForAuthResolution(routes.accountInactive, resolution);

  if (redirectPath) {
    redirect(redirectPath);
  }

  const message = resolution.state === "inactive"
    ? `Your Contento account is currently ${statusLabel(resolution.profile.status)}.`
    : "message" in resolution
      ? resolution.message
      : "This account cannot access Contento dashboards right now.";

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <span className="mb-2 flex size-12 overflow-hidden rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/contento-mark.svg" alt="" className="size-full object-cover" />
        </span>
        <CardTitle>Workspace access unavailable</CardTitle>
        <CardDescription>
          This account cannot access Contento dashboards right now.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Account status check failed</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
        <SignOutButton />
      </CardContent>
    </Card>
  );
}
