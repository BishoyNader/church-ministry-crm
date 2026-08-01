import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RegistrationError,
  RegistrationFunctions,
  RpcResult,
} from "@/types/registration";
import { toRegistrationError } from "@/types/registration";

type ServiceResult<T> = { data: T | null; error: RegistrationError | null };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * approve_servant(p_servant_id) — super_admin approval of a pending registration
 * (023 S11-5). Reactivation-first role grant (A3). Guards inside the RPC:
 * not_authenticated, self_approval_not_allowed, servant_not_found,
 * not_super_admin, servant_not_pending.
 */
export async function approveServant(
  supabase: SupabaseClient,
  servantId: string,
): Promise<ServiceResult<boolean>> {
  if (!UUID_PATTERN.test(servantId ?? "")) {
    return { data: null, error: { code: "servant_not_found", message: "Invalid servant id." } };
  }

  try {
    const result = (await supabase.rpc<
      "approve_servant",
      RegistrationFunctions["approve_servant"]["Args"]
    >("approve_servant", { p_servant_id: servantId })) as unknown as RpcResult<undefined>;

    if (result.error) {
      return { data: null, error: toRegistrationError(result.error) };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: { code: "unknown", message: "Failed to approve servant." } };
  }
}

/**
 * reject_servant(p_servant_id, p_reason?) — super_admin rejection (023 S11-6).
 * No role change; the applicant is notified with the optional reason.
 */
export async function rejectServant(
  supabase: SupabaseClient,
  servantId: string,
  reason?: string | null,
): Promise<ServiceResult<boolean>> {
  if (!UUID_PATTERN.test(servantId ?? "")) {
    return { data: null, error: { code: "servant_not_found", message: "Invalid servant id." } };
  }

  try {
    const result = (await supabase.rpc<
      "reject_servant",
      RegistrationFunctions["reject_servant"]["Args"]
    >("reject_servant", {
      p_servant_id: servantId,
      p_reason: reason?.trim() || null,
    })) as unknown as RpcResult<undefined>;

    if (result.error) {
      return { data: null, error: toRegistrationError(result.error) };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: { code: "unknown", message: "Failed to reject servant." } };
  }
}
