import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireAuthContext } from "@/lib/auth/context";
import { getOrganizationChatData } from "@/lib/chat/queries";
import { getRecentNotifications, getUnreadNotificationCount } from "@/lib/notifications/queries";
import { getCompanyBranding } from "@/lib/settings/queries";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const context = await requireAuthContext();
  const emptyChatData = { conversations: [], recipients: [] };
  const [unreadNotificationCount, recentNotifications, branding, chatData] = await Promise.all([
    getUnreadNotificationCount(context),
    getRecentNotifications(context),
    getCompanyBranding(context),
    getOrganizationChatData(context).catch(() => emptyChatData),
  ]);

  return (
    <DashboardShell
      context={context}
      unreadNotificationCount={unreadNotificationCount}
      recentNotifications={recentNotifications}
      chatData={chatData}
      branding={branding}
    >
      {children}
    </DashboardShell>
  );
}
