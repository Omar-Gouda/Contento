import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function RouteLoadingSkeleton({
  variant = "cards",
  rows = 4,
}: {
  variant?: "cards" | "table" | "calendar" | "dashboard";
  rows?: number;
}) {
  return (
    <section className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full max-w-md" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {variant === "dashboard" && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-lg" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-lg" />
            <Skeleton className="h-72 rounded-lg" />
          </div>
        </>
      )}

      {variant === "calendar" && (
        <>
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Skeleton className="h-9 w-20 rounded-lg" />
                <Skeleton className="h-9 w-20 rounded-lg" />
                <Skeleton className="h-9 w-20 rounded-lg" />
              </div>
              <Skeleton className="h-9 w-40 rounded-lg" />
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="grid grid-cols-7 border-b bg-secondary/30">
              {Array.from({ length: 7 }).map((_, index) => (
                <Skeleton key={index} className="m-2 h-4" />
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: 35 }).map((_, index) => (
                <div key={index} className="min-h-16 border-b border-r p-1 sm:min-h-28 sm:p-2">
                  <Skeleton className="mb-2 h-4 w-7" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {(variant === "cards" || variant === "table") && (
        <div className={cn("grid gap-4", variant === "cards" && "xl:grid-cols-2")}>
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="rounded-lg border bg-card p-5">
              <div className="flex items-start gap-3">
                <Skeleton className="size-12 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <div className="grid gap-3 pt-2 sm:grid-cols-3">
                    <Skeleton className="h-12 rounded-lg" />
                    <Skeleton className="h-12 rounded-lg" />
                    <Skeleton className="h-12 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
