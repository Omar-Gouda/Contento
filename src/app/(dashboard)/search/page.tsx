import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requirePermission } from "@/lib/auth/context";
import { getGlobalSearchResults } from "@/lib/search/queries";

export const metadata: Metadata = {
  title: "Search",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("search.global", "view");
  const query = params.q ?? "";
  const results = await getGlobalSearchResults(context, query);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Search</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Global search</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Search accessible users, teams, tasks, ideas, content, and reports inside your role scope.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search records</CardTitle>
          <CardDescription>Results are filtered by company, permissions, and team boundaries.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/search" className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="q">Query</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="q" name="q" defaultValue={query} className="pl-9" />
              </div>
            </div>
            <div className="flex items-end">
              <Button type="submit">Search</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {results.map((result) => (
          <Link
            key={`${result.module}-${result.id}`}
            href={result.href}
            className="grid gap-2 rounded-lg border bg-secondary/30 p-4 transition-colors hover:bg-secondary/60"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{result.module}</Badge>
              {result.status && <Badge variant="outline">{result.status}</Badge>}
            </div>
            <h2 className="font-semibold">{result.title}</h2>
            <p className="text-sm text-muted-foreground">{result.description}</p>
          </Link>
        ))}
        {query && !results.length && (
          <p className="rounded-lg border bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
            No accessible records matched this search.
          </p>
        )}
      </div>
    </section>
  );
}
