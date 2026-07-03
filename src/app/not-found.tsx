import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="mt-3 text-2xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The page may have moved, or you may not have access to it from this workspace.
        </p>
        <Link href="/sign-in" className={buttonVariants({ className: "mt-6" })}>
          Go to Contento
        </Link>
      </div>
    </main>
  );
}
