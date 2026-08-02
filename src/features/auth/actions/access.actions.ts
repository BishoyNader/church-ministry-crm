"use server";

import { getMyAccessState } from "../services/access.service";
import { createClient } from "@/lib/supabase/server";
import type { MyAccessStateResult } from "@/types/registration";

export type AccessStateActionResult = {
  data: MyAccessStateResult | null;
  error: string | null;
};

/**
 * getMyAccessStateAction — the caller's own onboarding/access state
 * (023 S11-3). Used by /pending-approval and pending-aware middleware.
 */
export async function getMyAccessStateAction(): Promise<AccessStateActionResult> {
  const supabase = await createClient();
  const result = await getMyAccessState(supabase);

  if (result.error) {
    return { data: null, error: result.error.message };
  }

  return { data: result.data ?? null, error: null };
}
