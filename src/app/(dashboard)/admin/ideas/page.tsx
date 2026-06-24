import type { Metadata } from "next";

import { IdeasSurface } from "@/components/dashboard/ideas-surface";
import { requirePermission } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Admin ideas",
};

export default async function AdminIdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("ideas.review", "full");

  return (
    <IdeasSurface
      context={context}
      basePath="/admin/ideas"
      title="Admin ideas"
      description="Company-wide idea management, assignment, notes, review state, and deletion controls."
      searchParams={params}
    />
  );
}

