import type { Metadata } from "next";

import { TaskManagementSurface } from "@/components/dashboard/task-management-surface";
import { requirePermission } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Admin tasks",
};

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; team?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("tasks.view", "full");

  return (
    <TaskManagementSurface
      context={context}
      basePath="/admin/tasks"
      title="Admin task management"
      description="Company-wide task assignment, reassignment, status control, comments, and team filtering."
      searchParams={params}
    />
  );
}

