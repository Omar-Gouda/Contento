import type { Metadata } from "next";

import { IdeasSurface } from "@/components/dashboard/ideas-surface";
import { requirePermission } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Ideas",
};

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("ideas.review", "view");

  return (
    <IdeasSurface
      context={context}
      basePath="/ideas"
      title="Ideas"
      description="Create, assign, review, and evolve content ideas before they move into production."
      searchParams={params}
    />
  );
}

