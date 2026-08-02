import type { SupabaseClient } from "@supabase/supabase-js";

export function generateSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
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
