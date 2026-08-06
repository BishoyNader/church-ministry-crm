import type { Json } from "./database.types";

// ============================================================================
// Phase 3C typed registration layer.
//
// Hand-typed overrides for the 8 RPCs introduced by migration 023, mirroring
// the shape that `supabase gen types` will produce when `database.types.ts` is
// regenerated against the post-023 staging schema (3C.2A.4 D20). Until then,
// `.rpc()` calls pass the Args/Returns contracts below explicitly.
//
// After regeneration, `RegistrationFunctions` may be dropped or retained as an
// interface layer; the wrappers remain valid because they pass Args explicitly.
// ============================================================================

export type RegistrationErrorCode =
  | "church_name_required"
  | "catechist_name_required"
  | "applicant_name_required"
  | "email_required"
  | "email_already_registered"
  | "request_already_pending"
  | "church_name_exists"
  | "not_authenticated"
  | "self_approval_not_allowed"
  | "servant_not_found"
  | "not_super_admin"
  | "servant_not_pending"
  | "servant_role_not_found"
  | "not_platform_owner"
  | "platform_owner_already_exists"
  | "platform_owner_role_not_found"
  | "auth_user_not_found"
  | "auth_user_email_mismatch"
  | "invalid_slug"
  | "super_admin_role_not_found"
  | "request_not_found"
  | "request_not_pending"
  | "church_id_required"
  | "auth_user_id_required"
  | "full_name_ar_required"
  | "roles_required"
  | "role_not_in_church"
  | "stage_not_in_church"
  | "church_not_found"
  | "not_allowed"
  | "unknown";

export type RegistrationError = {
  code: RegistrationErrorCode;
  message: string;
};

export type RpcResult<T> = {
  data: T | null;
  error: { message: string; code?: string; details?: string } | null;
};

// ---------------------------------------------------------------------------
// RPC return shapes (from 023 S11 definitions)
// ---------------------------------------------------------------------------

export type ListChurchesForSignupResult = {
  id: string;
  name_ar: string;
  slug: string;
};

export type MyAccessStateResult = {
  church_id: string | null;
  church_name_ar: string | null;
  servant_approval_status: string | null;
  role_types: string[];
  is_active: boolean | null;
  has_roles: boolean | null;
};

// ---------------------------------------------------------------------------
// Input payloads
// ---------------------------------------------------------------------------

export type SubmitChurchRequestInput = {
  churchNameAr: string;
  catechistName: string;
  applicantName: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
};

export type SendNotificationInput = {
  churchId: string | null;
  recipientId: string;
  notificationType: string;
  titleAr: string;
  titleEn?: string | null;
  bodyAr?: string | null;
  bodyEn?: string | null;
  data?: Json | null;
  channel?: string | null;
};

// ---------------------------------------------------------------------------
// RPC function contracts (mirrors Database["public"]["Functions"] shape)
// ---------------------------------------------------------------------------

export type RegistrationFunctions = {
  list_churches_for_signup: {
    Args: Record<never, never>;
    Returns: ListChurchesForSignupResult[];
  };
  submit_church_request: {
    Args: {
      p_church_name_ar: string;
      p_catechist_name: string;
      p_applicant_name: string;
      p_email: string;
      p_phone: string | null;
      p_notes?: string | null;
    };
    Returns: string;
  };
  get_my_access_state: {
    Args: Record<never, never>;
    Returns: MyAccessStateResult[];
  };
  approve_servant: {
    Args: { p_servant_id: string };
    Returns: undefined;
  };
  reject_servant: {
    Args: { p_servant_id: string; p_reason?: string | null };
    Returns: undefined;
  };
  approve_church_request: {
    Args: { p_request_id: string; p_auth_user_id: string; p_slug: string };
    Returns: undefined;
  };
  create_church_user: {
    Args: {
      p_church_id: string;
      p_auth_user_id: string;
      p_full_name_ar: string;
      p_full_name_en?: string | null;
      p_email: string;
      p_phone?: string | null;
      p_preferred_locale?: string | null;
      p_role_ids: string[];
      p_stage_ids?: string[] | null;
    };
    Returns: string;
  };
  reject_church_request: {
    Args: { p_request_id: string; p_reason?: string | null };
    Returns: undefined;
  };
  bootstrap_platform_owner: {
    Args: {
      p_auth_user_id: string;
      p_full_name_ar: string;
      p_email: string;
      p_phone?: string | null;
    };
    Returns: string;
  };
  send_notification: {
    Args: {
      p_church_id: string | null;
      p_recipient_id: string;
      p_notification_type: string;
      p_title_ar: string;
      p_title_en?: string | null;
      p_body_ar?: string | null;
      p_body_en?: string | null;
      p_data?: Json | null;
      p_channel?: string | null;
    };
    Returns: string;
  };
};

// ---------------------------------------------------------------------------
// Error mapping helper
// ---------------------------------------------------------------------------

const KNOWN_REGISTRATION_ERROR_CODES = new Set<RegistrationErrorCode>([
  "church_name_required",
  "catechist_name_required",
  "applicant_name_required",
  "email_required",
  "email_already_registered",
  "request_already_pending",
  "church_name_exists",
  "not_authenticated",
  "self_approval_not_allowed",
  "servant_not_found",
  "not_super_admin",
  "servant_not_pending",
  "servant_role_not_found",
  "not_platform_owner",
  "platform_owner_already_exists",
  "platform_owner_role_not_found",
  "auth_user_not_found",
  "auth_user_email_mismatch",
  "invalid_slug",
  "super_admin_role_not_found",
  "request_not_found",
  "request_not_pending",
  "church_id_required",
  "auth_user_id_required",
  "full_name_ar_required",
  "roles_required",
  "role_not_in_church",
  "stage_not_in_church",
  "church_not_found",
  "not_allowed",
]);

export function toRegistrationError(
  error: RpcResult<unknown>["error"] | null,
  fallback = "Registration request failed.",
): RegistrationError {
  const message = error?.message ?? fallback;
  const code: RegistrationErrorCode = KNOWN_REGISTRATION_ERROR_CODES.has(
    message as RegistrationErrorCode,
  )
    ? (message as RegistrationErrorCode)
    : "unknown";
  return { code, message };
}
