import Link from "next/link";
import { Bookmark, Trash2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveViewAction, deleteViewAction } from "@/lib/saved-views/actions";
import { getSavedViews } from "@/lib/saved-views/queries";
import type { AuthContext } from "@/lib/auth/permissions";
import type { Json } from "@/types/database";

function filtersToQuery(filters: Json) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return "";
  }

  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (typeof value === "string" && value && value !== "all") {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function SavedViewsPanel({
  context,
  module,
  currentFilters,
  basePath,
}: {
  context: AuthContext;
  module: string;
  currentFilters: Record<string, string | undefined>;
  basePath: string;
}) {
  const views = await getSavedViews(context, module);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bookmark className="size-4 text-primary" />
          Saved views
        </CardTitle>
        <CardDescription>Save and reuse common filters for this page.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form action={saveViewAction} className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input type="hidden" name="module" value={module} />
          <input type="hidden" name="redirectTo" value={basePath} />
          <input type="hidden" name="filtersJson" value={JSON.stringify(currentFilters)} />
          <div className="space-y-2">
            <Label htmlFor={`saved-view-${module}`}>View name</Label>
            <Input id={`saved-view-${module}`} name="name" placeholder="My open work" />
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="outline">Save view</Button>
          </div>
        </form>

        <div className="flex flex-wrap gap-2">
          {views.map((view) => (
            <div key={view.id} className="flex items-center gap-1 rounded-lg border bg-secondary/30 p-1">
              <Link href={`${basePath}${filtersToQuery(view.filters_json)}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                {view.name}
              </Link>
              <form action={deleteViewAction}>
                <input type="hidden" name="viewId" value={view.id} />
                <input type="hidden" name="redirectTo" value={basePath} />
                <Button type="submit" variant="ghost" size="icon" aria-label={`Delete ${view.name}`}>
                  <Trash2 />
                </Button>
              </form>
            </div>
          ))}
          {!views.length && <p className="text-sm text-muted-foreground">No saved views yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
