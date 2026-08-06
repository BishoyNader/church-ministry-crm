import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type ServiceResult<T> = { data: T | null; error: string | null };

type ChurchRow = { slug: string };

type ProvisioningRpcResult<T> = { data: T | null; error: { message: string } | null };

type ProvisioningRpcClient = {
  rpc: {
    list_churches_for_signup: () => Promise<ProvisioningRpcResult<ChurchRow[]>>;
    approve_church_request: (args: {
      p_request_id: string;
      p_auth_user_id: string;
      p_slug: string;
    }) => Promise<ProvisioningRpcResult<string>>;
    reject_church_request: (args: {
      p_request_id: string;
      p_reason: string | null;
    }) => Promise<ProvisioningRpcResult<string>>;
    provision_church: (args: {
      p_church_name_ar: string;
      p_church_name_en: string | null;
      p_slug: string;
      p_contact_email: string | null;
      p_contact_phone: string | null;
      p_address_ar: string | null;
      p_auth_user_id: string;
      p_full_name_ar: string;
      p_full_name_en: string | null;
      p_email: string;
      p_phone: string | null;
    }) => Promise<ProvisioningRpcResult<string>>;
    create_church_super_admin: (args: {
      p_church_id: string;
      p_auth_user_id: string;
      p_full_name_ar: string;
      p_full_name_en: string | null;
      p_email: string;
      p_phone: string | null;
    }) => Promise<ProvisioningRpcResult<string>>;
  };
};

function asProvisioningClient(supabase: SupabaseClient<Database>): ProvisioningRpcClient {
  return supabase as unknown as ProvisioningRpcClient;
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

  const result = await asProvisioningClient(supabase).rpc.list_churches_for_signup();
  if (result.error) {
    return normalized;
  }

  const existing = new Set((result.data ?? []).map((item) => item.slug));
  let slug = normalized;
  let counter = 1;

  while (existing.has(slug)) {
    slug = `${normalized}-${counter++}`;
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
    const result = await asProvisioningClient(supabase).rpc.approve_church_request({
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
    const result = await asProvisioningClient(supabase).rpc.reject_church_request({
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
    churchNameEn?: string;
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
    const result = await asProvisioningClient(supabase).rpc.provision_church({
      p_church_name_ar: input.churchNameAr,
      p_church_name_en: input.churchNameEn ?? null,
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
    const result = await asProvisioningClient(supabase).rpc.create_church_super_admin({
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