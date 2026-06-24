import { redirect } from "next/navigation";

import { routes } from "@/constants/routes";
import { resolveAuthProfile } from "@/lib/auth/context";
import { getRedirectPathForAuthResolution } from "@/lib/auth/route-access";

export default async function HomePage() {
  const resolution = await resolveAuthProfile();
  const redirectPath = getRedirectPathForAuthResolution(routes.home, resolution);

  redirect(redirectPath ?? routes.signIn);
}
