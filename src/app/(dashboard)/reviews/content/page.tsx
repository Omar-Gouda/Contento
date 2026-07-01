import type { Metadata } from "next";

import { ContentSurface } from "@/components/dashboard/content-surface";
import { requirePermission } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Content reviews",
};

export default async function ContentReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; team?: string; client?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("reviews.view_submissions", "view");

  return <ContentSurface context={context} mode="reviews" searchParams={params} />;
}
