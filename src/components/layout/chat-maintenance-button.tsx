"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ChatMaintenanceButton() {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = window.setTimeout(() => closeButtonRef.current?.focus(), 80);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Open chat maintenance message"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <MessageCircle />
      </Button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[999] grid place-items-center bg-black/55 px-4 py-4 backdrop-blur-sm sm:px-6"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setOpen(false);
                }
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="chat-maintenance-title"
                aria-describedby="chat-maintenance-description"
                className={cn(
                  "relative w-full max-w-md overflow-hidden rounded-2xl border bg-background p-6 text-center shadow-2xl",
                  "animate-in fade-in zoom-in-95 slide-in-from-bottom-3 duration-200"
                )}
              >
                <button
                  ref={closeButtonRef}
                  type="button"
                  aria-label="Close chat maintenance message"
                  onClick={() => setOpen(false)}
                  className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <X className="size-4" />
                </button>

                <div className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7C3AED,#9D5CFF,#C084FC)] text-white shadow-[0_18px_60px_rgba(124,58,237,0.38)]">
                  <MessageCircle className="size-9" />
                </div>
                <h2 id="chat-maintenance-title" className="mt-6 text-2xl font-semibold tracking-normal">
                  Chat is under maintenance
                </h2>
                <p id="chat-maintenance-description" className="mt-3 text-sm leading-6 text-muted-foreground">
                  We&apos;re rebuilding the messaging experience to make it faster, more reliable, and better for everyone.
                  <br />
                  The feature will return in a future update.
                </p>
                <Button type="button" className="mt-6 w-full" onClick={() => setOpen(false)}>
                  Got it
                </Button>
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
