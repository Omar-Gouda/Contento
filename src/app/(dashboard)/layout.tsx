import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireAuthContext } from "@/lib/auth/context";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const context = await requireAuthContext();

  return <DashboardShell context={context}>{children}</DashboardShell>;
}
