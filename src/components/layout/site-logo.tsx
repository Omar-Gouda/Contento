import Link from "next/link";

import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";

export function SiteLogo({ showText = true }: { showText?: boolean }) {
  return (
    <Link href={routes.home} className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center overflow-hidden rounded-xl bg-primary/10 shadow-sm ring-1 ring-primary/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/contento-mark.svg" alt="" className="size-full object-cover" />
      </span>
      <span className={cn("leading-none", !showText && "sr-only")}>
        <span className="block text-base font-semibold tracking-[0.12em] text-foreground">contento</span>
        <span className="mt-1 hidden text-[0.56rem] font-bold uppercase tracking-[0.28em] text-primary sm:block">
          Create. Content. Impact.
        </span>
      </span>
    </Link>
  );
}
