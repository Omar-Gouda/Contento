"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";

import { signOutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton({
  compact = false,
  hasActiveWorkSession = false,
  hasActiveBreak = false,
}: {
  compact?: boolean;
  hasActiveWorkSession?: boolean;
  hasActiveBreak?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (hasActiveWorkSession) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size={compact ? "icon" : "default"}
          aria-label={compact ? "Sign out" : undefined}
          title={compact ? "Sign out" : undefined}
          onClick={() => setConfirming(true)}
        >
          <LogOut />
          {!compact && "Sign out"}
        </Button>

        {confirming && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sign-out-title"
            className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm"
          >
            <div className="w-full max-w-md rounded-xl border bg-card p-5 shadow-2xl">
              <h2 id="sign-out-title" className="text-lg font-semibold">Clock out before signing out?</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Your work session is still active. Clock out to save today&apos;s working time before ending your login session.
              </p>
              {hasActiveBreak && (
                <p className="mt-3 rounded-lg border bg-secondary/40 p-3 text-sm text-muted-foreground">
                  End your active break before signing out.
                </p>
              )}
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                {hasActiveBreak ? (
                  <Link href="/profile/work-hours">
                    <Button type="button">Open work hours</Button>
                  </Link>
                ) : (
                  <form action={signOutAction}>
                    <Button type="submit">
                      <LogOut />
                      Clock out and sign out
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <form action={signOutAction}>
      <Button
        type="submit"
        variant="outline"
        size={compact ? "icon" : "default"}
        aria-label={compact ? "Sign out" : undefined}
        title={compact ? "Sign out" : undefined}
      >
        <LogOut />
        {!compact && "Sign out"}
      </Button>
    </form>
  );
}
