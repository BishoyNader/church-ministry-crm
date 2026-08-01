import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ListChurchesForSignupResult,
  RegistrationError,
  RegistrationFunctions,
  RpcResult,
} from "@/types/registration";
import { toRegistrationError } from "@/types/registration";

type ServiceResult<T> = { data: T | null; error: RegistrationError | null };

/**
 * list_churches_for_signup() — public signup dropdown (023 S11-3).
 * Exposes identity fields only; no contact/subscription data. Works for
 * anon and authenticated callers (granted to both, 023 S12).
 */
export async function listChurchesForSignup(
  supabase: SupabaseClient,
): Promise<ServiceResult<ListChurchesForSignupResult[]>> {
  try {
    const result = (await supabase.rpc<
      "list_churches_for_signup",
      RegistrationFunctions["list_churches_for_signup"]["Args"]
    >("list_churches_for_signup")) as unknown as RpcResult<ListChurchesForSignupResult[]>;

    if (result.error) {
      return { data: null, error: toRegistrationError(result.error) };
    }

    return { data: result.data ?? [], error: null };
  } catch {
    return { data: null, error: { code: "unknown", message: "Failed to load churches." } };
  }
}
