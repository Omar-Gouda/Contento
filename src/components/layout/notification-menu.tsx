"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/notifications/actions";
import type { NotificationRow } from "@/lib/notifications/queries";

const notificationSoundKey = "contento-notification-sound-enabled";

function playNotificationSound() {
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = 740;
  gain.gain.value = 0.04;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.12);
}

export function NotificationMenu({
  unreadCount,
  notifications,
}: {
  unreadCount: number;
  notifications: NotificationRow[];
}) {
  const pathname = usePathname();
  const previousUnreadCount = useRef(unreadCount);
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setSoundEnabled(window.localStorage.getItem(notificationSoundKey) === "true");
    });
  }, []);

  useEffect(() => {
    if (soundEnabled && unreadCount > previousUnreadCount.current) {
      playNotificationSound();
    }

    previousUnreadCount.current = unreadCount;
  }, [soundEnabled, unreadCount]);

  function updateSoundPreference(enabled: boolean) {
    setSoundEnabled(enabled);
    window.localStorage.setItem(notificationSoundKey, String(enabled));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" size="icon" className="relative" aria-label="Notifications" />
        }
      >
        <Bell />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-80 p-2">
        <div className="flex items-center justify-between gap-3 px-1.5 py-1">
          <div className="text-sm font-semibold">Notifications</div>
          {unreadCount > 0 && (
            <form action={markAllNotificationsReadAction}>
              <input type="hidden" name="redirectTo" value={pathname} />
              <Button type="submit" variant="ghost" size="sm">
                <CheckCheck />
                Mark all
              </Button>
            </form>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 space-y-2 overflow-y-auto px-1 py-1">
          {notifications.map((notification) => (
            <div key={notification.id} className="rounded-lg border bg-secondary/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {notification.link_href ? (
                    <Link href={notification.link_href} className="line-clamp-2 text-sm font-medium hover:text-primary">
                      {notification.title}
                    </Link>
                  ) : (
                    <p className="line-clamp-2 text-sm font-medium">{notification.title}</p>
                  )}
                  {notification.message && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
                  )}
                </div>
                {!notification.read && <span className="mt-1 size-2 rounded-full bg-primary" aria-label="Unread" />}
              </div>
              {!notification.read && (
                <form action={markNotificationReadAction} className="mt-2">
                  <input type="hidden" name="notificationId" value={notification.id} />
                  <input type="hidden" name="redirectTo" value={pathname} />
                  <Button type="submit" variant="outline" size="sm">
                    Mark read
                  </Button>
                </form>
              )}
            </div>
          ))}
          {!notifications.length && (
            <div className="rounded-lg border border-dashed px-3 py-6 text-center">
              <p className="text-sm font-medium">All clear</p>
              <p className="mt-1 text-xs text-muted-foreground">
                New task, review, mention, and workspace updates will appear here.
              </p>
            </div>
          )}
        </div>
        <DropdownMenuSeparator />
        <label className="flex items-center justify-between gap-3 rounded-md px-1.5 py-2 text-sm">
          <span>Sound</span>
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(event) => updateSoundPreference(event.target.checked)}
            className="size-4"
          />
        </label>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
