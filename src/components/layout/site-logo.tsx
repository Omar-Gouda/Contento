import Link from "next/link";

import { routes } from "@/constants/routes";

export function SiteLogo() {
  return (
    <Link href={routes.home} className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
        C
      </span>
      <span className="text-base font-semibold tracking-normal">Contento</span>
    </Link>
  );
}
