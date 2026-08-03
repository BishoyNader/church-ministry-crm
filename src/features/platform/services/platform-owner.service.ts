import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RegistrationError,
  RegistrationFunctions,
  RpcResult,
} from "@/types/registration";
import { toRegistrationError } from "@/types/registration";

type ServiceResult<T> = { data: T | null; error: RegistrationError | null };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BootstrapPlatformOwnerInput = {
  authUserId: string;
  fullNameAr: string;
  email: string;
  phone?: string | null;
};

function invalid<T = undefined>(code: RegistrationError["code"], message: string): ServiceResult<T> {
  return { data: null, error: { code, message } };
}

/**
 * Returns true when an active global (church-less) role grant already exists.
 * Used by the action as a cheap pre-check before provisioning the auth account;
 * the RPC's single-flight guard is the authoritative defense.
 */
export async function hasExistingPlatformOwner(admin: SupabaseClient): Promise<boolean> {
  const { data: roles } = await admin.from("roles").select("id").is("church_id", null);

  if (!roles || roles.length === 0) {
    return false;
  }

  const roleIds = roles.map((role) => role.id);

  const { count } = await admin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .is("church_id", null)
    .is("end_date", null)
    .in("role_id", roleIds);

  return (count ?? 0) > 0;
}

/**
 * bootstrap_platform_owner(p_auth_user_id, p_full_name_ar, p_email, p_phone) —
 * one-time Platform Owner provisioning (026 S7). SECURITY DEFINER +
 * service_role-only EXECUTE. Creates the church-less profile, the approved
 * servant row, and the single global role grant. Raises
 * platform_owner_already_exists on any second run.
 */
export async function bootstrapPlatformOwner(
  admin: SupabaseClient,
  input: BootstrapPlatformOwnerInput,
): Promise<ServiceResult<string>> {
  if (!UUID_PATTERN.test(input.authUserId ?? "")) {
    return invalid("auth_user_not_found", "Invalid auth user id.");
  }
  if (!EMAIL_PATTERN.test(input.email?.trim() ?? "")) {
    return invalid("email_required", "A valid email address is required.");
  }
  if (!input.fullNameAr?.trim()) {
    return invalid("applicant_name_required", "The full name (Arabic) is required.");
  }

  try {
    const result = (await admin.rpc<
      "bootstrap_platform_owner",
      RegistrationFunctions["bootstrap_platform_owner"]["Args"]
    >("bootstrap_platform_owner", {
      p_auth_user_id: input.authUserId,
      p_full_name_ar: input.fullNameAr.trim(),
      p_email: input.email.trim(),
      p_phone: input.phone?.trim() || null,
    })) as unknown as RpcResult<string>;

    if (result.error) {
      return { data: null, error: toRegistrationError(result.error) };
    }

    return { data: result.data ?? null, error: null };
  } catch {
    return { data: null, error: { code: "unknown", message: "Failed to bootstrap the platform owner." } };
  }
}
