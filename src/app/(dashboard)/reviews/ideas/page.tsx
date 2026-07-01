import type { Metadata } from "next";

import { IdeaReviewSurface } from "@/components/dashboard/idea-review-surface";
import { requirePermission } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Idea reviews",
};

export default async function IdeaReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("ideas.review", "view");

  return <IdeaReviewSurface context={context} searchParams={params} />;
}
