import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RegistrationError,
  RegistrationFunctions,
  RpcResult,
} from "@/types/registration";
import { toRegistrationError } from "@/types/registration";
import { ensureUniqueSlug, generateSlug } from "@/lib/utils/slug";

type ServiceResult<T> = { data: T | null; error: RegistrationError | null };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function invalid(code: RegistrationError["code"], message: string): ServiceResult<undefined> {
  return { data: null, error: { code, message } };
}

/**
 * Composes generateSlug + ensureUniqueSlug for the provisioning caller.
 * The migration's slug contract requires a lowercase `[a-z0-9-]` slug that is
 * unique across churches (023 S11-7).
 */
export async function buildUniqueChurchSlug(
  admin: SupabaseClient,
  churchName: string,
): Promise<string> {
  return ensureUniqueSlug(admin, generateSlug(churchName));
}

/**
 * approve_church_request(p_request_id, p_auth_user_id, p_slug) — platform-owner
 * provisioning (023 S11-7). Single atomic transaction creating the church,
 * profile, approved servant row, and initial super_admin grant. Guards are
 * enforced inside the RPC (not_platform_owner, email match, etc.).
 */
export async function approveChurchRequest(
  supabase: SupabaseClient,
  requestId: string,
  authUserId: string,
  slug: string,
): Promise<ServiceResult<undefined>> {
  if (!UUID_PATTERN.test(requestId ?? "")) {
    return invalid("request_not_found", "Invalid request id.");
  }
  if (!UUID_PATTERN.test(authUserId ?? "")) {
    return invalid("auth_user_not_found", "Invalid auth user id.");
  }
  if (!SLUG_PATTERN.test(slug ?? "")) {
    return invalid("invalid_slug", "Invalid church slug.");
  }

  try {
    const result = (await supabase.rpc<
      "approve_church_request",
      RegistrationFunctions["approve_church_request"]["Args"]
    >("approve_church_request", {
      p_request_id: requestId,
      p_auth_user_id: authUserId,
      p_slug: slug,
    })) as unknown as RpcResult<undefined>;

    if (result.error) {
      return { data: null, error: toRegistrationError(result.error) };
    }

    return { data: null, error: null };
  } catch {
    return { data: null, error: { code: "unknown", message: "Failed to approve church request." } };
  }
}

/**
 * reject_church_request(p_request_id, p_reason) — platform-owner rejection
 * (023 S11-8). Nothing is created; the request is transitioned to rejected.
 */
export async function rejectChurchRequest(
  supabase: SupabaseClient,
  requestId: string,
  reason?: string | null,
): Promise<ServiceResult<undefined>> {
  if (!UUID_PATTERN.test(requestId ?? "")) {
    return invalid("request_not_found", "Invalid request id.");
  }

  try {
    const result = (await supabase.rpc<
      "reject_church_request",
      RegistrationFunctions["reject_church_request"]["Args"]
    >("reject_church_request", {
      p_request_id: requestId,
      p_reason: reason?.trim() || null,
    })) as unknown as RpcResult<undefined>;

    if (result.error) {
      return { data: null, error: toRegistrationError(result.error) };
    }

    return { data: null, error: null };
  } catch {
    return { data: null, error: { code: "unknown", message: "Failed to reject church request." } };
  }
}
