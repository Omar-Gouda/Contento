"use client";

import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function RootError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Contento could not load</AlertTitle>
          <AlertDescription>
            Something went wrong while loading this page. Try again, or return later if the problem continues.
          </AlertDescription>
        </Alert>
        <Button type="button" className="mt-4" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
