import type { ReactNode } from "react";

import { requireDashboardAccess } from "@/lib/auth/context";

export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  await requireDashboardAccess("admin");

  return children;
}
