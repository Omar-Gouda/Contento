import type { ReactNode } from "react";

import { SuperAdminShell } from "@/components/layout/super-admin-shell";
import { requireSuperiorAdminContext } from "@/lib/auth/context";

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const context = await requireSuperiorAdminContext();

  return <SuperAdminShell email={context.email}>{children}</SuperAdminShell>;
}
