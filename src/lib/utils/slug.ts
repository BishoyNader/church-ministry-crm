import type { SupabaseClient } from "@supabase/supabase-js";

export function generateSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || `church-${Date.now()}`;
}

export async function ensureUniqueSlug(
  admin: SupabaseClient,
  baseSlug: string,
): Promise<string> {
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    const { data } = await admin
      .from("churches")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (!data) return candidate;

    candidate = `${baseSlug}-${counter}`;
    counter++;
  }
}
