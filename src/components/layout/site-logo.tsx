import Link from "next/link";

import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";

export function SiteLogo({ showText = true }: { showText?: boolean }) {
  return (
    <Link href={routes.home} className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
        C
      </span>
      <span className={cn("text-base font-semibold tracking-normal", !showText && "sr-only")}>Contento</span>
    </Link>
  );
}
