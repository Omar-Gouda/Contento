import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/context";
import { getDefaultDashboardPath } from "@/types/roles";

export const metadata: Metadata = {
  title: "Search",
};

export default async function SearchPage() {
  const context = await requireAuthContext();

  redirect(getDefaultDashboardPath(context.role));
}
