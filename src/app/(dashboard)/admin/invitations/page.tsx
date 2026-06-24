import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { routes } from "@/constants/routes";

export const metadata: Metadata = {
  title: "User creation",
};

export default function AdminInvitationsPage() {
  redirect(routes.admin.users);
}
