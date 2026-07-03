"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CheckCheck, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  updateNotificationPreferencesAction,
  updateNotificationSoundPreferenceAction,
} from "@/lib/notifications/actions";
import type { NotificationRow } from "@/lib/notifications/queries";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const notificationSoundKey = "contento-notification-sound-enabled";
const notificationDesktopKey = "contento-notification-desktop-enabled";
const notificationColumns =
  "id, company_id, user_id, title, message, read, entity_type, entity_id, link_href, read_at, created_at, updated_at";
type BrowserNotificationPermission = NotificationPermission | "unsupported";

async function playNotificationSound() {
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

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
  userId,
  companyId,
  initialSoundEnabled = true,
  initialDesktopEnabled = false,
}: {
  unreadCount: number;
  notifications: NotificationRow[];
  userId: string;
  companyId: string;
  initialSoundEnabled?: boolean;
  initialDesktopEnabled?: boolean;
}) {
  const pathname = usePathname();
  const previousUnreadCount = useRef(unreadCount);
  const userInteracted = useRef(false);
  const [isPending, startTransition] = useTransition();
  const [soundEnabled, setSoundEnabled] = useState(initialSoundEnabled);
  const [desktopEnabled, setDesktopEnabled] = useState(initialDesktopEnabled);
  const [browserPermission, setBrowserPermission] =
    useState<BrowserNotificationPermission>("unsupported");
  const [items, setItems] = useState(notifications);
  const [localUnreadCount, setLocalUnreadCount] = useState(unreadCount);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [toastNotification, setToastNotification] = useState<NotificationRow | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setItems(notifications);
      setLocalUnreadCount(unreadCount);
      previousUnreadCount.current = unreadCount;
    });
  }, [notifications, unreadCount]);

  useEffect(() => {
    queueMicrotask(() => {
      setSoundEnabled(initialSoundEnabled);
      window.localStorage.setItem(notificationSoundKey, String(initialSoundEnabled));
    });
  }, [initialSoundEnabled]);

  useEffect(() => {
    queueMicrotask(() => {
      setDesktopEnabled(initialDesktopEnabled);
      window.localStorage.setItem(notificationDesktopKey, String(initialDesktopEnabled));
    });
  }, [initialDesktopEnabled]);

  useEffect(() => {
    queueMicrotask(() => {
      setBrowserPermission("Notification" in window ? window.Notification.permission : "unsupported");
    });
  }, []);

  useEffect(() => {
    function markInteraction() {
      userInteracted.current = true;
    }

    window.addEventListener("pointerdown", markInteraction, { once: true });
    window.addEventListener("keydown", markInteraction, { once: true });

    return () => {
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("keydown", markInteraction);
    };
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function refreshNotifications(showToast: boolean) {
      const [{ data }, { count }] = await Promise.all([
        supabase
          .from("notifications")
          .select(notificationColumns)
          .eq("company_id", companyId)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("user_id", userId)
          .eq("read", false),
      ]);
      const nextItems = (data as NotificationRow[] | null) ?? [];
      const nextUnreadCount = count ?? 0;

      setItems(nextItems);
      setLocalUnreadCount(nextUnreadCount);

      if (showToast && nextUnreadCount > previousUnreadCount.current) {
        const newestUnread = nextItems.find((notification) => !notification.read);

        if (newestUnread) {
          setToastNotification(newestUnread);

          if (soundEnabled && userInteracted.current) {
            void playNotificationSound().catch(() => undefined);
          }

          if (
            desktopEnabled &&
            browserPermission === "granted" &&
            "Notification" in window &&
            document.visibilityState !== "visible"
          ) {
            const desktopNotification = new window.Notification(newestUnread.title, {
              body: newestUnread.message || "You have a new Contento update.",
              icon: "/icons/icon-192.png",
            });

            desktopNotification.onclick = () => {
              window.focus();
              if (newestUnread.link_href) {
                window.location.href = newestUnread.link_href;
              }
            };
          }
        }
      }

      previousUnreadCount.current = nextUnreadCount;
    }

    const channel = supabase
      .channel(`contento-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refreshNotifications(true);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [browserPermission, companyId, desktopEnabled, soundEnabled, userId]);

  function updateSoundPreference(enabled: boolean) {
    const previous = soundEnabled;

    setSoundEnabled(enabled);
    window.localStorage.setItem(notificationSoundKey, String(enabled));
    setActionStatus(null);

    startTransition(async () => {
      const result = await updateNotificationSoundPreferenceAction(enabled);
      setActionStatus(result.message);

      if (!result.success) {
        setSoundEnabled(previous);
        window.localStorage.setItem(notificationSoundKey, String(previous));
      }
    });
  }

  async function requestBrowserPermission() {
    if (!("Notification" in window)) {
      setBrowserPermission("unsupported");
      setActionStatus("Browser notifications are not supported on this device.");
      return;
    }

    setActionStatus(null);
    const permission = await window.Notification.requestPermission();

    setBrowserPermission(permission);

    if (permission !== "granted") {
      setDesktopEnabled(false);
      window.localStorage.setItem(notificationDesktopKey, "false");
      setActionStatus(
        permission === "denied"
          ? "Browser notifications are blocked in this browser."
          : "Browser notifications were not enabled."
      );
      return;
    }

    setDesktopEnabled(true);
    window.localStorage.setItem(notificationDesktopKey, "true");
    startTransition(async () => {
      const result = await updateNotificationPreferencesAction({ desktop: true });
      setActionStatus(result.message);

      if (!result.success) {
        setDesktopEnabled(false);
        window.localStorage.setItem(notificationDesktopKey, "false");
      }
    });
  }

  function updateDesktopPreference(enabled: boolean) {
    const previous = desktopEnabled;

    if (enabled && browserPermission !== "granted") {
      void requestBrowserPermission();
      return;
    }

    setDesktopEnabled(enabled);
    window.localStorage.setItem(notificationDesktopKey, String(enabled));
    setActionStatus(null);

    startTransition(async () => {
      const result = await updateNotificationPreferencesAction({ desktop: enabled });
      setActionStatus(result.message);

      if (!result.success) {
        setDesktopEnabled(previous);
        window.localStorage.setItem(notificationDesktopKey, String(previous));
      }
    });
  }

  function markRead(notificationId: string) {
    const notification = items.find((item) => item.id === notificationId);
    const formData = new FormData();

    formData.set("notificationId", notificationId);
    formData.set("redirectTo", pathname);
    setActionStatus(null);
    setItems((current) => current.map((item) => item.id === notificationId ? { ...item, read: true } : item));
    if (notification && !notification.read) {
      setLocalUnreadCount((current) => Math.max(0, current - 1));
    }

    startTransition(async () => {
      const result = await markNotificationReadAction(formData);
      setActionStatus(result.message);

      if (!result.success) {
        setItems((current) => current.map((item) => item.id === notificationId ? { ...item, read: false } : item));
        if (notification && !notification.read) {
          setLocalUnreadCount((current) => current + 1);
        }
      }
    });
  }

  function markAllRead() {
    const unreadTotal = items.filter((item) => !item.read).length;
    const formData = new FormData();

    formData.set("redirectTo", pathname);
    setActionStatus(null);
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setLocalUnreadCount(0);

    startTransition(async () => {
      const result = await markAllNotificationsReadAction(formData);
      setActionStatus(result.message);

      if (!result.success) {
        setItems((current) => current.map((item) => ({ ...item, read: false })));
        setLocalUnreadCount((current) => current + unreadTotal);
      }
    });
  }

  return (
    <>
      {toastNotification && (
        <div className="fixed right-4 top-20 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-card p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-semibold">{toastNotification.title}</p>
              {toastNotification.message && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{toastNotification.message}</p>
              )}
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setToastNotification(null)} aria-label="Dismiss notification">
              <X />
            </Button>
          </div>
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="outline" size="icon" className="relative" aria-label="Notifications" />
          }
        >
          <Bell />
          {localUnreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {localUnreadCount}
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-80 p-2">
          <div className="flex items-center justify-between gap-3 px-1.5 py-1">
            <div className="text-sm font-semibold">Notifications</div>
            {localUnreadCount > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={markAllRead} disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : <CheckCheck />}
                Mark all
              </Button>
            )}
          </div>
          {actionStatus && (
            <p className="px-1.5 pb-1 text-xs text-muted-foreground" role="status">
              {actionStatus}
            </p>
          )}
          <DropdownMenuSeparator />
          <div className="max-h-80 space-y-2 overflow-y-auto px-1 py-1">
            {items.map((notification) => (
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
                  <div className="mt-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => markRead(notification.id)} disabled={isPending}>
                      Mark read
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {!items.length && (
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
          <label className="flex items-center justify-between gap-3 rounded-md px-1.5 py-2 text-sm">
            <span>Desktop alerts</span>
            <input
              type="checkbox"
              checked={desktopEnabled && browserPermission === "granted"}
              disabled={browserPermission === "unsupported" || isPending}
              onChange={(event) => updateDesktopPreference(event.target.checked)}
              className="size-4"
            />
          </label>
          <div className="rounded-md bg-secondary/40 px-1.5 py-2 text-xs text-muted-foreground">
            {browserPermission === "unsupported" && "Desktop notifications are not supported on this browser."}
            {browserPermission === "denied" && "Desktop notifications are blocked in browser settings."}
            {browserPermission === "default" && (
              <Button type="button" variant="ghost" size="sm" onClick={requestBrowserPermission} disabled={isPending}>
                Enable browser notifications
              </Button>
            )}
            {browserPermission === "granted" && "Browser notifications are enabled for this device."}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
