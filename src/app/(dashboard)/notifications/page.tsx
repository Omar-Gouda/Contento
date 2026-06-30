import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/context";
import { getDefaultDashboardPath } from "@/types/roles";

export const metadata: Metadata = {
  title: "Notifications",
};

export default async function NotificationsPage() {
  const context = await requirePermission("notifications.view", "view");

  redirect(getDefaultDashboardPath(context.role));
}
