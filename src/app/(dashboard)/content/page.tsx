import type { Metadata } from "next";

import { ContentSurface } from "@/components/dashboard/content-surface";
import { requirePermission } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Content",
};

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("content.track_pipeline", "view");

  return <ContentSurface context={context} mode="pipeline" searchParams={params} />;
}

