"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ImageUp, Trash2 } from "lucide-react";

import { removeOrganizationLogoAction, uploadOrganizationLogoAction } from "@/lib/settings/actions";
import { removeClientLogoAction, uploadClientLogoAction } from "@/lib/clients/actions";
import { Button } from "@/components/ui/button";

function LogoSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" disabled={pending}>
      <ImageUp />
      {pending ? "Uploading..." : label}
    </Button>
  );
}

export function OrganizationLogoUpload({
  initialLogoUrl,
  organizationName,
}: {
  initialLogoUrl: string | null;
  organizationName: string;
}) {
  return (
    <LogoUploadForm
      action={uploadOrganizationLogoAction}
      inputName="logo"
      initialLogoUrl={initialLogoUrl}
      fallbackLabel={organizationName}
      submitLabel="Upload logo"
      removeAction={removeOrganizationLogoAction}
      removeLabel="Remove logo"
    />
  );
}

export function ClientLogoUpload({
  clientId,
  initialLogoUrl,
  clientName,
}: {
  clientId: string;
  initialLogoUrl: string | null;
  clientName: string;
}) {
  return (
    <LogoUploadForm
      action={uploadClientLogoAction}
      inputName="logo"
      initialLogoUrl={initialLogoUrl}
      fallbackLabel={clientName}
      submitLabel="Upload client logo"
      removeAction={removeClientLogoAction}
      removeLabel="Remove client logo"
    >
      <input type="hidden" name="clientId" value={clientId} />
    </LogoUploadForm>
  );
}

function LogoUploadForm({
  action,
  inputName,
  initialLogoUrl,
  fallbackLabel,
  submitLabel,
  removeAction,
  removeLabel,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  inputName: string;
  initialLogoUrl: string | null;
  fallbackLabel: string;
  submitLabel: string;
  removeAction: (formData: FormData) => void | Promise<void>;
  removeLabel: string;
  children?: ReactNode;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialLogoUrl);
  const [clientError, setClientError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const initials = fallbackLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  function updatePreview(nextFile: File | null) {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (!nextFile) {
      setPreviewUrl(initialLogoUrl);
      return;
    }

    const nextPreview = URL.createObjectURL(nextFile);
    objectUrlRef.current = nextPreview;
    setPreviewUrl(nextPreview);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[96px_1fr] sm:items-center">
      <div className="flex size-24 items-center justify-center overflow-hidden rounded-2xl border bg-secondary text-xl font-semibold text-primary">
        {previewUrl ? (
          // Private storage paths are rendered through signed URLs. Object-fit provides a safe square crop preview.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={`${fallbackLabel} logo`} className="size-full object-cover object-center" />
        ) : (
          initials || "C"
        )}
      </div>
      <div className="grid gap-3">
        <form action={action} className="grid gap-3">
          {children}
          <input
            name={inputName}
            type="file"
            accept="image/*"
            onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              setClientError(null);

              if (next && !next.type.startsWith("image/")) {
                updatePreview(null);
                setClientError("Choose a JPG, PNG, WebP, or GIF image.");
                event.currentTarget.value = "";
                return;
              }

              if (next && next.size > 5 * 1024 * 1024) {
                updatePreview(null);
                setClientError("Logo image must be 5 MB or smaller.");
                event.currentTarget.value = "";
                return;
              }

              updatePreview(next);
            }}
            className="h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <LogoSubmitButton label={submitLabel} />
        </form>
        {initialLogoUrl && (
          <form action={removeAction}>
            {children}
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              onClick={(event) => {
                if (!window.confirm("Remove the current logo?")) {
                  event.preventDefault();
                }
              }}
            >
              <Trash2 />
              {removeLabel}
            </Button>
          </form>
        )}
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WebP, or GIF. Maximum 5 MB. Logos are displayed as centered square crops.
        </p>
        {clientError && <p className="text-sm text-destructive">{clientError}</p>}
      </div>
    </div>
  );
}
