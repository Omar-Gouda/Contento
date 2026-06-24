import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireAuthContext } from "@/lib/auth/context";
import { getUnreadNotificationCount } from "@/lib/notifications/queries";
import { getCompanyBranding } from "@/lib/settings/queries";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const context = await requireAuthContext();
  const [unreadNotificationCount, branding] = await Promise.all([
    getUnreadNotificationCount(context),
    getCompanyBranding(context),
  ]);

  return (
    <DashboardShell context={context} unreadNotificationCount={unreadNotificationCount} branding={branding}>
      {children}
    </DashboardShell>
  );
}
