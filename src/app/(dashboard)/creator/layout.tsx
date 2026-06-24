import type { ReactNode } from "react";

import { requireDashboardAccess } from "@/lib/auth/context";

export default async function CreatorDashboardLayout({ children }: { children: ReactNode }) {
  await requireDashboardAccess("creator");

  return children;
}
