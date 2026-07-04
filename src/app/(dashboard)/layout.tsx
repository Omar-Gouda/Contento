import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireAuthContext } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { getRecentNotifications, getUnreadNotificationCount } from "@/lib/notifications/queries";
import { getCompanyBranding, getUserNotificationPreferences } from "@/lib/settings/queries";
import { getCurrentUserWorkHours } from "@/lib/work-hours/queries";
import { isInternalUserRole } from "@/types/roles";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const context = await requireAuthContext();
  const [unreadNotificationCount, recentNotifications, notificationPreferences, branding, workHours] = await Promise.all([
    getUnreadNotificationCount(context),
    getRecentNotifications(context),
    getUserNotificationPreferences(context),
    getCompanyBranding(context),
    isInternalUserRole(context.role) || hasPermission(context, "work_hours.view_own", "view")
      ? getCurrentUserWorkHours(context).catch(() => null)
      : null,
  ]);

  return (
    <DashboardShell
      context={context}
      unreadNotificationCount={unreadNotificationCount}
      recentNotifications={recentNotifications}
      notificationPreferences={notificationPreferences}
      branding={branding}
      workHours={workHours}
    >
      {children}
    </DashboardShell>
  );
}
