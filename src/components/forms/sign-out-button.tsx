import { LogOut } from "lucide-react";

import { signOutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
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
