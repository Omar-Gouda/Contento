import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireAuthContext } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { getOrganizationChatData } from "@/lib/chat/queries";
import { getRecentNotifications, getUnreadNotificationCount } from "@/lib/notifications/queries";
import { getCompanyBranding } from "@/lib/settings/queries";
import { getCurrentUserWorkHours } from "@/lib/work-hours/queries";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const context = await requireAuthContext();
  const emptyChatData = { conversations: [], recipients: [] };
  const [unreadNotificationCount, recentNotifications, branding, chatData, workHours] = await Promise.all([
    getUnreadNotificationCount(context),
    getRecentNotifications(context),
    getCompanyBranding(context),
    getOrganizationChatData(context).catch(() => emptyChatData),
    hasPermission(context, "work_hours.view_own", "view")
      ? getCurrentUserWorkHours(context).catch(() => null)
      : null,
  ]);

  return (
    <DashboardShell
      context={context}
      unreadNotificationCount={unreadNotificationCount}
      recentNotifications={recentNotifications}
      chatData={chatData}
      branding={branding}
      workHours={workHours}
    >
      {children}
    </DashboardShell>
  );
}
