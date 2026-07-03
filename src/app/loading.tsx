export default function RootLoading() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <div className="h-3 w-24 animate-pulse rounded-full bg-primary/30" />
        <div className="mt-6 space-y-3">
          <div className="h-4 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-4/5 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </main>
  );
}
