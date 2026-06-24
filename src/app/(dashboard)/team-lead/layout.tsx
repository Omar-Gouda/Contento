import type { ReactNode } from "react";

import { requireDashboardAccess } from "@/lib/auth/context";

export default async function TeamLeadDashboardLayout({ children }: { children: ReactNode }) {
  await requireDashboardAccess("team-lead");

  return children;
}
