"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { clearOrganizationTemporaryPasswordFlashAction } from "@/lib/organization-requests/admin-actions";

export function OrganizationTemporaryPasswordFlash({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    clearOrganizationTemporaryPasswordFlashAction().catch(() => undefined);
  }, []);

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/10 p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">Temporary owner password</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Shown once for {email}. Share it through a secure channel; Contento does not store this password.
            </p>
            <code className="mt-3 block w-full overflow-x-auto rounded-xl border bg-background px-3 py-2 text-sm font-semibold text-foreground">
              {password}
            </code>
          </div>
        </div>
        <Button type="button" onClick={copyPassword} className="shrink-0">
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy password"}
        </Button>
      </div>
    </section>
  );
}
