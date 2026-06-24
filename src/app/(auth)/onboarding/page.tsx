import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/forms/onboarding-form";
import { routes } from "@/constants/routes";
import { resolveAuthProfile } from "@/lib/auth/context";
import { getRedirectPathForAuthResolution } from "@/lib/auth/route-access";

export const metadata: Metadata = {
  title: "Onboarding",
};

export default async function OnboardingPage() {
  const resolution = await resolveAuthProfile();
  const redirectPath = getRedirectPathForAuthResolution(routes.onboarding, resolution);

  if (redirectPath) {
    redirect(redirectPath);
  }

  if (resolution.state !== "missing_profile") {
    redirect(routes.accountInactive);
  }

  return <OnboardingForm email={resolution.user.email} />;
}
