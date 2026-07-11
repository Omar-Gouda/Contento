"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaProvider() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const isLocalDevelopment =
        process.env.NODE_ENV !== "production" ||
        ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(window.location.hostname);

      if (isLocalDevelopment) {
        void navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
          .catch(() => undefined);

        if ("caches" in window) {
          void caches
            .keys()
            .then((keys) => Promise.all(keys.filter((key) => key.startsWith("contento-")).map((key) => caches.delete(key))))
            .catch(() => undefined);
        }

        return;
      }

      window.addEventListener("load", () => {
        void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      }, { once: true });
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setDismissed(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  if (!installPrompt || dismissed) {
    return null;
  }

  async function install() {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => undefined);
    setInstallPrompt(null);
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-card p-3 shadow-xl sm:bottom-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/contento-icon.svg" alt="" className="size-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install Contento</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Add Contento to your home screen for faster access.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button type="button" size="sm" onClick={install}>
              Install
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDismissed(true)}>
              Not now
            </Button>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss install prompt"
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
