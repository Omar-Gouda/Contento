"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";

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

export function FormSheet({
  title,
  description,
  triggerLabel,
  children,
  className,
  triggerClassName,
}: {
  title: string;
  description?: string;
  triggerLabel: string;
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
}) {
  const showPlusIcon = !triggerLabel.toLowerCase().startsWith("edit");

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button type="button" className={cn(pageActionButtonClass, triggerClassName)} />
        }
      >
        {showPlusIcon && <Plus />}
        {triggerLabel}
      </SheetTrigger>
      <SheetContent
        side="right"
        className={cn(
          "inset-0 h-full w-full overflow-y-auto p-0 sm:inset-y-0 sm:left-auto sm:w-[min(42rem,92vw)] sm:max-w-none",
          className
        )}
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
