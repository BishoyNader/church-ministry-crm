import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type ServiceResult<T> = { data: T | null; error: string | null };

type ChurchRow = { slug: string };

type RpcResult<T> = { data: T | null; error: { message: string } | null };

/**
 * The provisioning RPCs (list_churches_for_signup, approve_church_request,
 * reject_church_request, provision_church, create_church_super_admin) are not
 * part of the generated Database["public"]["Functions"] types, so the typed
 * `supabase.rpc(name, args)` signature rejects them. These helpers cast only
 * the `rpc` callable itself and keep the CORRECT runtime invocation shape
 * (`rpc("function_name", args)`) — previously the service used a cast that
 * looked like `rpc.provision_church(...)`, which is not a function at runtime
 * and threw `TypeError: ...rpc.provision_church is not a function`.
 */
type RpcCallable = (
  name: string,
  args?: Record<string, unknown>,
) => Promise<RpcResult<unknown>>;

function callRpc(
  supabase: SupabaseClient<Database>,
  name: string,
  args?: Record<string, unknown>,
): Promise<RpcResult<unknown>> {
  return (supabase.rpc as unknown as RpcCallable)(name, args);
}

export function buildUniqueChurchSlug(
  supabase: SupabaseClient<Database>,
  base: string,
): string {
  const normalized = base
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "church";

  return normalized;
}

export async function ensureUniqueSlug(
  supabase: SupabaseClient<Database>,
  base: string,
): Promise<string> {
  const normalized = buildUniqueChurchSlug(supabase, base);

  const result = await callRpc(supabase, "list_churches_for_signup");
  if (result.error) {
    return normalized;
  }

  const existing = new Set(((result.data as ChurchRow[] | null) ?? []).map((item) => item.slug));
  let slug = normalized;
  let counter = 1;

  while (existing.has(slug)) {
    slug = `${normalized}-${counter}`;
    counter++;
  }

  return slug;
}

export async function approveChurchRequest(
  supabase: SupabaseClient<Database>,
  requestId: string,
  authUserId: string,
  slug: string,
): Promise<ServiceResult<{ churchId: string }>> {
  try {
    const result = await callRpc(supabase, "approve_church_request", {
      p_request_id: requestId,
      p_auth_user_id: authUserId,
      p_slug: slug,
    });

    if (result.error) {
      return { data: null, error: result.error.message };
    }

    return { data: { churchId: String(result.data) }, error: null };
  } catch {
    return { data: null, error: "Failed to approve church request." };
  }
}

export async function rejectChurchRequest(
  supabase: SupabaseClient<Database>,
  requestId: string,
  reason?: string | null,
): Promise<ServiceResult<null>> {
  try {
    const result = await callRpc(supabase, "reject_church_request", {
      p_request_id: requestId,
      p_reason: reason ?? null,
    });

    if (result.error) {
      return { data: null, error: result.error.message };
    }

    return { data: null, error: null };
  } catch {
    return { data: null, error: "Failed to reject church request." };
  }
}

export async function provisionChurch(
  supabase: SupabaseClient<Database>,
  input: {
    churchNameAr: string;
    slug: string;
    contactEmail?: string;
    contactPhone?: string;
    addressAr?: string;
    authUserId: string;
    fullNameAr: string;
    fullNameEn?: string;
    email: string;
    phone?: string;
  },
): Promise<ServiceResult<{ churchId: string }>> {
  try {
    const result = await callRpc(supabase, "provision_church", {
      p_church_name_ar: input.churchNameAr,
      p_slug: input.slug,
      p_contact_email: input.contactEmail ?? null,
      p_contact_phone: input.contactPhone ?? null,
      p_address_ar: input.addressAr ?? null,
      p_auth_user_id: input.authUserId,
      p_full_name_ar: input.fullNameAr,
      p_full_name_en: input.fullNameEn ?? null,
      p_email: input.email,
      p_phone: input.phone ?? null,
    });

    if (result.error) {
      return { data: null, error: result.error.message };
    }

    return { data: { churchId: String(result.data) }, error: null };
  } catch {
    return { data: null, error: "Failed to provision church." };
  }
}

export async function createChurchSuperAdmin(
  supabase: SupabaseClient<Database>,
  input: {
    churchId: string;
    authUserId: string;
    fullNameAr: string;
    fullNameEn?: string;
    email: string;
    phone?: string;
  },
): Promise<ServiceResult<{ userId: string }>> {
  try {
    const result = await callRpc(supabase, "create_church_super_admin", {
      p_church_id: input.churchId,
      p_auth_user_id: input.authUserId,
      p_full_name_ar: input.fullNameAr,
      p_full_name_en: input.fullNameEn ?? null,
      p_email: input.email,
      p_phone: input.phone ?? null,
    });

    if (result.error) {
      return { data: null, error: result.error.message };
    }

    return { data: { userId: String(result.data) }, error: null };
  } catch {
    return { data: null, error: "Failed to create church super admin." };
  }
}
