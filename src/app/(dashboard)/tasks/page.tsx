import type { Metadata } from "next";

import { TaskManagementSurface } from "@/components/dashboard/task-management-surface";
import { requirePermission } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Tasks",
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; team?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("tasks.view", "view");

  return (
    <TaskManagementSurface
      context={context}
      basePath="/tasks"
      title="Tasks"
      description="Create, assign, comment on, and move work through the documented task workflow."
      searchParams={params}
    />
  );
}

