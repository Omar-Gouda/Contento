"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Camera, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { removeAvatarAction, uploadAvatarAction } from "@/lib/settings/actions";

function AvatarSubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" disabled={pending || disabled}>
      <Camera />
      {pending ? "Uploading..." : disabled ? "Preparing..." : "Upload avatar"}
    </Button>
  );
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image could not be read."));
    };
    image.src = url;
  });
}

async function prepareAvatarFile(file: File) {
  const image = await loadImage(file);
  const size = Math.min(image.naturalWidth, image.naturalHeight);
  const targetSize = 512;
  const sourceX = Math.max(0, Math.floor((image.naturalWidth - size) / 2));
  const sourceY = Math.max(0, Math.floor((image.naturalHeight - size) / 2));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return file;
  }

  canvas.width = targetSize;
  canvas.height = targetSize;
  context.drawImage(image, sourceX, sourceY, size, size, 0, 0, targetSize, targetSize);

  const blob = await canvasToBlob(canvas, "image/webp", 0.86);

  if (!blob) {
    return file;
  }

  return new File([blob], "avatar.webp", {
    type: "image/webp",
    lastModified: Date.now(),
  });
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
  const [isProcessing, setIsProcessing] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  async function handleFileChange(file: File | null) {
    setClientError(null);

    if (!file) {
      updatePreview(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      updatePreview(null);
      setClientError("Choose a JPG, PNG, WebP, or GIF image.");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      updatePreview(null);
      setClientError("Avatar image must be 5 MB or smaller.");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    setIsProcessing(true);

    try {
      const preparedFile = await prepareAvatarFile(file);
      const transfer = new DataTransfer();

      transfer.items.add(preparedFile);

      if (inputRef.current) {
        inputRef.current.files = transfer.files;
      }

      updatePreview(preparedFile);
    } catch {
      updatePreview(file);
      setClientError("Avatar preview was prepared from the original image.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[96px_1fr] md:items-center">
      <div className="flex size-24 items-center justify-center overflow-hidden rounded-2xl border bg-secondary text-xl font-semibold text-primary">
        {previewUrl ? (
          // Private Supabase Storage paths are rendered through short-lived signed URLs.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={`${displayName} avatar`}
            className="size-full object-cover"
            onError={() => setPreviewUrl(null)}
          />
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
        <form action={uploadAvatarAction} className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="sr-only" htmlFor={inputId}>Avatar image</label>
          <input
            ref={inputRef}
            id={inputId}
            name="avatar"
            type="file"
            accept="image/*"
            onChange={(e) => {
              void handleFileChange(e.target.files?.[0] ?? null);
            }}
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
          />
          <AvatarSubmitButton disabled={isProcessing} />
        </form>
        {initialAvatarUrl && (
          <form action={removeAvatarAction}>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              onClick={(event) => {
                if (!window.confirm("Remove your current avatar?")) {
                  event.preventDefault();
                }
              }}
            >
              <Trash2 />
              Remove avatar
            </Button>
          </form>
        )}
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WebP, or GIF. Images are cropped square and compressed before upload.
        </p>
        {clientError && <p className="text-sm text-destructive">{clientError}</p>}
      </div>
    </div>
  );
}

