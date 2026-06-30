import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireAuthContext } from "@/lib/auth/context";
import { getRecentNotifications, getUnreadNotificationCount } from "@/lib/notifications/queries";
import { getCompanyBranding } from "@/lib/settings/queries";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const context = await requireAuthContext();
  const [unreadNotificationCount, recentNotifications, branding] = await Promise.all([
    getUnreadNotificationCount(context),
    getRecentNotifications(context),
    getCompanyBranding(context),
  ]);

  return (
    <DashboardShell
      context={context}
      unreadNotificationCount={unreadNotificationCount}
      recentNotifications={recentNotifications}
      branding={branding}
    >
      {children}
    </DashboardShell>
  );
}
