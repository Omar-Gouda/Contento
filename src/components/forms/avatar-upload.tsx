"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Camera } from "lucide-react";

import { Button } from "@/components/ui/button";

import { uploadAvatarAction } from "@/lib/settings/actions";

function AvatarSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" disabled={pending}>
      <Camera />
      {pending ? "Uploading..." : "Upload avatar"}
    </Button>
  );
}

export function AvatarUpload({
  initialAvatarUrl,
  displayName,
}: {
  initialAvatarUrl: string | null;
  displayName: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialAvatarUrl);
  const [clientError, setClientError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const inputId = useMemo(() => "avatar", []);

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
      setPreviewUrl(initialAvatarUrl);
      return;
    }

    const nextPreview = URL.createObjectURL(nextFile);
    objectUrlRef.current = nextPreview;
    setPreviewUrl(nextPreview);
  }

  return (
    <form
      action={uploadAvatarAction}
      className="grid gap-4 md:grid-cols-[96px_1fr] md:items-center"
    >
      <div className="flex size-24 items-center justify-center overflow-hidden rounded-2xl border bg-secondary text-xl font-semibold text-primary">
        {previewUrl ? (
          // Private Supabase Storage paths are rendered through short-lived signed URLs.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={`${displayName} avatar`} className="size-full object-cover" />
        ) : (
          displayName
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        )}
      </div>

      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="sr-only" htmlFor={inputId}>
            Avatar image
          </label>
          <input
            id={inputId}
            name="avatar"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              setClientError(null);

              if (next && !next.type.startsWith("image/")) {
                updatePreview(null);
                setClientError("Choose a JPG, PNG, WebP, or GIF image.");
                e.currentTarget.value = "";
                return;
              }

              if (next && next.size > 5 * 1024 * 1024) {
                updatePreview(null);
                setClientError("Avatar image must be 5 MB or smaller.");
                e.currentTarget.value = "";
                return;
              }

              updatePreview(next);
            }}
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
          />

          <AvatarSubmitButton />
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WebP, or GIF. Maximum file size is 5 MB.
        </p>
        {clientError && <p className="text-sm text-destructive">{clientError}</p>}
      </div>
    </form>
  );
}

