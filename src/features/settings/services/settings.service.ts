import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ProfileSettings,
  ChurchSettings,
  UpdateProfileInput,
  UpdateChurchInput,
} from "../types/settings.types";

type ServiceResult<T> = { data: T | null; error: string | null };

export async function getProfileSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<ServiceResult<ProfileSettings>> {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, full_name_ar, full_name_en, phone, preferred_locale, church_id")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      return { data: null, error: "Profile not found." };
    }

    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role_id, roles(id, name_ar, name_en, role_type)")
      .eq("user_id", userId)
      .is("end_date", null);

    const roles = (userRoles ?? [])
      .map((ur) => ur.roles)
      .filter(Boolean) as unknown as ProfileSettings["roles"];

    let church: ProfileSettings["church"] = null;
    if (profile.church_id) {
      const { data: churchData } = await supabase
        .from("churches")
        .select("id, name_ar")
        .eq("id", profile.church_id)
        .single();
      church = churchData ?? null;
    }

    return {
      data: {
        id: profile.id,
        email: profile.email,
        fullNameAr: profile.full_name_ar,
        fullNameEn: profile.full_name_en,
        phone: profile.phone,
        preferredLocale: profile.preferred_locale,
        roles,
        church,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to load profile settings." };
  }
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateProfileInput,
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name_ar: input.fullNameAr,
        full_name_en: input.fullNameEn?.trim() || null,
        phone: input.phone?.trim() || null,
        preferred_locale: input.preferredLocale,
      })
      .eq("id", userId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to update profile." };
  }
}

export async function getChurchSettings(
  supabase: SupabaseClient,
  churchId: string,
): Promise<ServiceResult<ChurchSettings>> {
  try {
    const { data, error } = await supabase
      .from("churches")
      .select("id, name_ar, contact_email, contact_phone, address_ar, address_en, logo_url")
      .eq("id", churchId)
      .single();

    if (error || !data) {
      return { data: null, error: "Church not found." };
    }

    return { data: data as ChurchSettings, error: null };
  } catch {
    return { data: null, error: "Failed to load church settings." };
  }
}

export async function updateChurch(
  supabase: SupabaseClient,
  churchId: string,
  input: UpdateChurchInput,
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from("churches")
      .update({
        name_ar: input.nameAr,
        contact_email: input.contactEmail?.trim() || null,
        contact_phone: input.contactPhone?.trim() || null,
        address_ar: input.addressAr?.trim() || null,
        address_en: input.addressEn?.trim() || null,
        logo_url: input.logoUrl?.trim() || null,
      })
      .eq("id", churchId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to update church settings." };
  }
}