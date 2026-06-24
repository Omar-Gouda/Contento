import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";

export async function createNotificationForUser({
  context,
  userId,
  title,
  message,
  entityType,
  entityId,
  linkHref,
}: {
  context: AuthContext;
  userId: string | null | undefined;
  title: string;
  message?: string;
  entityType?: string;
  entityId?: string | null;
  linkHref?: string | null;
}) {
  if (!userId || userId === context.userId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.from("notifications").insert({
    company_id: context.companyId,
    user_id: userId,
    title,
    message: message ?? "",
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    link_href: linkHref ?? null,
    read: false,
  });
}
