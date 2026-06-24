import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/forms/change-password-form";
import { routes } from "@/constants/routes";
import { resolveAuthProfile } from "@/lib/auth/context";
import { getRedirectPathForAuthResolution } from "@/lib/auth/route-access";

export const metadata: Metadata = {
  title: "Change password",
};

export default async function ChangePasswordPage() {
  const resolution = await resolveAuthProfile();
  const redirectPath = getRedirectPathForAuthResolution(routes.changePassword, resolution);

  if (redirectPath) {
    redirect(redirectPath);
  }

  return <ChangePasswordForm />;
}
