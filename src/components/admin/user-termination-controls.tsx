"use client";

import { useState } from "react";
import { Archive, Trash2, X } from "lucide-react";

import { terminateUserAction } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UserTerminationControls({
  userId,
  userName,
  disabled = false,
}: {
  userId: string;
  userName: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Trash2 />
        Delete
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border bg-popover p-5 text-popover-foreground shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Delete {userName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose how Contento should handle this user&apos;s historical work.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close">
                <X />
              </Button>
            </div>

            <div className="mt-5 grid gap-4">
              <form action={terminateUserAction} className="rounded-lg border bg-secondary/25 p-4">
                <input type="hidden" name="userId" value={userId} />
                <input type="hidden" name="mode" value="keep_content" />
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Archive className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">Delete user and keep their content</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Tasks, ideas, content, and reports remain available. Ownership references fall back to Unknown User where the original profile is gone.
                    </p>
                    <Button type="submit" className="mt-3" variant="outline">
                      Keep content
                    </Button>
                  </div>
                </div>
              </form>

              <form action={terminateUserAction} className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                <input type="hidden" name="userId" value={userId} />
                <input type="hidden" name="mode" value="remove_content" />
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                    <Trash2 className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-destructive">Delete user and remove their content</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      This action permanently removes the user and their owned work.
                    </p>
                    <div className="mt-3 grid gap-2">
                      <Label htmlFor={`delete-confirm-${userId}`}>Type DELETE to confirm</Label>
                      <Input id={`delete-confirm-${userId}`} name="confirmation" placeholder="DELETE" />
                    </div>
                    <Button type="submit" className="mt-3" variant="destructive">
                      Remove content
                    </Button>
                  </div>
                </div>
              </form>
            </div>

            <div className="mt-5 flex justify-end">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
