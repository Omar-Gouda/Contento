import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";
import type { Database } from "@/types/database";

export async function getSavedViews(context: AuthContext, module: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("saved_views")
    .select("id, company_id, user_id, name, module, filters_json, is_default, created_at, updated_at")
    .eq("company_id", context.companyId)
    .eq("user_id", context.userId)
    .eq("module", module)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    return [];
  }

  return (data as Database["public"]["Tables"]["saved_views"]["Row"][] | null) ?? [];
}
