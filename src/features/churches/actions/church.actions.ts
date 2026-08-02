"use server";

import { listChurchesForSignup } from "../services/churches.service";
import { createClient } from "@/lib/supabase/server";
import type { ListChurchesForSignupResult } from "@/types/registration";

export type ChurchListActionResult = {
  data: ListChurchesForSignupResult[] | null;
  error: string | null;
};

/**
 * listChurchesForSignupAction — public signup dropdown source
 * (023 S11-2). Exposes identity fields only.
 */
export async function listChurchesForSignupAction(): Promise<ChurchListActionResult> {
  const supabase = await createClient();
  const result = await listChurchesForSignup(supabase);

  if (result.error) {
    return { data: null, error: result.error.message };
  }

  return { data: result.data ?? [], error: null };
}
