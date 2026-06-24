"use client";

import { AlertCircle } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl py-12">
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Dashboard could not load</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
      <Button type="button" className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
