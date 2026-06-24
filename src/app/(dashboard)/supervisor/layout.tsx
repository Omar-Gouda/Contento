import type { ReactNode } from "react";

import { requireDashboardAccess } from "@/lib/auth/context";

export default async function SupervisorDashboardLayout({ children }: { children: ReactNode }) {
  await requireDashboardAccess("supervisor");

  return children;
}
