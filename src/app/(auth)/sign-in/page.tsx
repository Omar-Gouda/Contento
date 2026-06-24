import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/forms/sign-in-form";
import { routes } from "@/constants/routes";
import { resolveAuthProfile } from "@/lib/auth/context";
import { getRedirectPathForAuthResolution } from "@/lib/auth/route-access";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const resolution = await resolveAuthProfile();
  const redirectPath = getRedirectPathForAuthResolution(routes.signIn, resolution);

  if (redirectPath) {
    redirect(redirectPath);
  }

  const params = await searchParams;

  return <SignInForm resetSuccess={params.reset === "success"} />;
}
