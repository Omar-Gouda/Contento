export default function RootLoading() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-10 overflow-hidden rounded-xl bg-primary/10 ring-1 ring-primary/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/contento-mark.svg" alt="" className="size-full object-cover" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-[0.12em]">contento</p>
            <p className="text-xs text-muted-foreground">Loading workspace</p>
          </div>
        </div>
        <div className="mt-6 h-3 w-24 animate-pulse rounded-full bg-primary/30" />
        <div className="mt-6 space-y-3">
          <div className="h-4 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-4/5 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </main>
  );
}
