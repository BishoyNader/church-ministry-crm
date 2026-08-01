import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MyAccessStateResult,
  RegistrationError,
  RegistrationFunctions,
  RpcResult,
} from "@/types/registration";
import { toRegistrationError } from "@/types/registration";

type ServiceResult<T> = { data: T | null; error: RegistrationError | null };

/**
 * get_my_access_state() — single round-trip for middleware and the
 * /pending-approval page (023 S11-3). Hardcoded to auth.uid(); returns the
 * caller's own profile + servant + active role grants. Empty result when the
 * caller has no profile (anon / no account). Authenticated only.
 */
export async function getMyAccessState(
  supabase: SupabaseClient,
): Promise<ServiceResult<MyAccessStateResult>> {
  try {
    const result = (await supabase.rpc<
      "get_my_access_state",
      RegistrationFunctions["get_my_access_state"]["Args"]
    >("get_my_access_state")) as unknown as RpcResult<MyAccessStateResult[]>;

    if (result.error) {
      return { data: null, error: toRegistrationError(result.error) };
    }

    return { data: result.data?.[0] ?? null, error: null };
  } catch {
    return { data: null, error: { code: "unknown", message: "Failed to load access state." } };
  }
}
