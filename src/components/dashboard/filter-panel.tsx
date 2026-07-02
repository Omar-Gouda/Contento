"use client";

import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pageActionButtonClass } from "@/components/dashboard/page-header";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type ActiveFilter = {
  label: string;
  value: string | null | undefined;
};

export function activeFilterChips(filters: ActiveFilter[]) {
  return filters.filter((filter) => {
    const value = filter.value;
    return Boolean(value && value !== "all");
  });
}

export function FilterPanel({
  title = "Filters",
  description,
  activeFilters = [],
  children,
  className,
}: {
  title?: string;
  description?: string;
  activeFilters?: ActiveFilter[];
  children: ReactNode;
  className?: string;
}) {
  const chips = activeFilterChips(activeFilters);

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(pageActionButtonClass, className)}
          />
        }
      >
        <SlidersHorizontal />
        {title}
        {chips.length > 0 && <Badge variant="secondary">{chips.length}</Badge>}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="inset-0 h-full w-full overflow-y-auto p-0 sm:inset-y-0 sm:left-auto sm:w-[min(28rem,92vw)] sm:max-w-none"
      >
        <SheetHeader className="border-b px-5 py-5">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="px-5 py-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
