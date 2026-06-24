import { AlertCircle, CheckCircle2 } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

export function PageMessage({
  error,
  status,
}: {
  error?: string;
  status?: string;
}) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Action failed</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (status) {
    return (
      <Alert>
        <CheckCircle2 className="size-4" />
        <AlertTitle>Saved</AlertTitle>
        <AlertDescription>
          {status === "invited"
            ? "Invitation sent successfully."
            : status === "created"
              ? "User created successfully."
            : status === "updated"
              ? "The update was saved."
              : status}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
