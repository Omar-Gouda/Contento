import Link from "next/link";
import type { Metadata } from "next";
import { Bell, CheckCheck } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { requirePermission } from "@/lib/auth/context";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/notifications/actions";
import { getNotifications, type NotificationFilter } from "@/lib/notifications/queries";
import { formatCairoDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Notifications",
};

function normalizeFilter(value: string | undefined): NotificationFilter {
  return value === "read" || value === "unread" ? value : "all";
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("notifications.view", "view");
  const filter = normalizeFilter(params.filter);
  const notifications = await getNotifications(context, filter);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Notifications</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Notification center</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Review task, content, comment, and workspace events delivered to your account.
          </p>
        </div>
        <form action={markAllNotificationsReadAction}>
          <Button type="submit" variant="outline" disabled={unreadCount === 0}>
            <CheckCheck />
            Mark all read
          </Button>
        </form>
      </div>

      <PageMessage
        error={params.error}
        status={params.notice === "read" || params.notice === "all-read" ? "Notifications updated." : undefined}
      />

      <div className="flex flex-wrap gap-2">
        {(["all", "unread", "read"] as const).map((item) => (
          <Link
            key={item}
            href={`${routes.notifications}?filter=${item}`}
            className={buttonVariants({ variant: filter === item ? "default" : "outline", size: "sm" })}
          >
            {item}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>{unreadCount} unread notification{unreadCount === 1 ? "" : "s"} in this view.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {notifications.map((notification) => (
            <div key={notification.id} className="grid gap-3 rounded-lg border bg-secondary/30 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Bell className="size-4 text-primary" />
                  <h2 className="font-semibold">{notification.title}</h2>
                  <Badge variant={notification.read ? "secondary" : "default"}>{notification.read ? "read" : "unread"}</Badge>
                </div>
                {notification.message && <p className="mt-2 text-sm text-muted-foreground">{notification.message}</p>}
                <p className="mt-2 text-xs text-muted-foreground">{formatCairoDateTime(notification.created_at)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {notification.link_href && (
                  <Link href={notification.link_href} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                    Open
                  </Link>
                )}
                {!notification.read && (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="notificationId" value={notification.id} />
                    <Button type="submit" variant="outline" size="sm">Mark read</Button>
                  </form>
                )}
              </div>
            </div>
          ))}
          {!notifications.length && (
            <p className="rounded-lg border bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
              No notifications match this view.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
