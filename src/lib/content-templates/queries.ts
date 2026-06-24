import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";
import type { Database } from "@/types/database";

export type ContentTemplate = Database["public"]["Tables"]["content_templates"]["Row"] & {
  creatorName: string | null;
};

export async function getContentTemplates(context: AuthContext) {
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { data: users }] = await Promise.all([
    supabase
      .from("content_templates")
      .select("id, company_id, title, description, body, category, status, created_by, created_at, updated_at")
      .eq("company_id", context.companyId)
      .order("status", { ascending: true })
      .order("updated_at", { ascending: false }),
    supabase.from("users").select("id, email, first_name, last_name").eq("company_id", context.companyId),
  ]);

  if (error) {
    throw new Error("Unable to load content templates.");
  }

  const userById = new Map(
    ((users as Array<{ id: string; email: string; first_name: string; last_name: string }> | null) ?? []).map((user) => {
      const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email;
      return [user.id, name];
    })
  );

  return ((data as Database["public"]["Tables"]["content_templates"]["Row"][] | null) ?? []).map((template) => ({
    ...template,
    creatorName: template.created_by ? userById.get(template.created_by) ?? null : null,
  }));
}
