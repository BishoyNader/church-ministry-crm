"use server";

import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import { getMyAccessState } from "@/features/auth/services/access.service";
import { updatePassword } from "@/features/auth/services/auth.service";
import {
  updateProfileSchema,
  updateChurchSchema,
  changePasswordSchema,
} from "../schemas/settings.schema";
import type {
  UpdateProfileFormValues,
  UpdateChurchFormValues,
  ChangePasswordFormValues,
} from "../schemas/settings.schema";
import type {
  ProfileSettings,
  ChurchSettings,
} from "../types/settings.types";
import * as settingsService from "../services/settings.service";
import { ZodError } from "zod";

export type SettingsActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  data?: T;
};

function handleZodError(error: unknown): SettingsActionResult<never> {
  if (error instanceof ZodError) {
    return {
      success: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [issue.path.join("."), issue.message]),
      ),
    };
  }
  return {
    success: false,
    message: "An unexpected validation error occurred.",
  };
}

async function isChurchAdminOrPlatformOwner(): Promise<boolean> {
  const supabase = await createClient();
  const access = await getMyAccessState(supabase);
  const roleTypes = access.data?.role_types ?? [];
  return roleTypes.includes("super_admin") || roleTypes.includes("platform_owner");
}

export async function getProfileSettingsAction(): Promise<SettingsActionResult<ProfileSettings>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };
  if (!(await hasPermission(PERMISSION_CODES.SETTINGS_READ))) {
    return { success: false, message: "You do not have permission to view settings." };
  }
  const result = await settingsService.getProfileSettings(supabase, user.id);
  if (result.error) return { success: false, message: result.error };
  return { success: true, data: result.data ?? undefined };
}

export async function updateProfileAction(
  values: UpdateProfileFormValues,
): Promise<SettingsActionResult> {
  try {
    updateProfileSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };
  if (!(await hasPermission(PERMISSION_CODES.SETTINGS_READ))) {
    return { success: false, message: "You do not have permission to view settings." };
  }
  const existing = await settingsService.getProfileSettings(supabase, user.id);
  const oldValues = existing.data ?? undefined;
  const result = await settingsService.updateProfile(supabase, user.id, {
    fullNameAr: values.fullNameAr,
    fullNameEn: values.fullNameEn,
    phone: values.phone,
    preferredLocale: values.preferredLocale,
  });
  if (result.error) return { success: false, message: result.error };
  await writeAuditLog(supabase, "update", "profile", user.id, oldValues, values);
  return { success: true, message: "Profile updated successfully." };
}

export async function getChurchSettingsAction(): Promise<SettingsActionResult<ChurchSettings>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };
  if (!(await hasPermission(PERMISSION_CODES.SETTINGS_READ))) {
    return { success: false, message: "You do not have permission to view settings." };
  }
  if (!(await isChurchAdminOrPlatformOwner())) {
    return { success: false, message: "You do not have permission to view church settings." };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();
  if (!profile?.church_id) {
    return { success: false, message: "Church not found." };
  }
  const result = await settingsService.getChurchSettings(supabase, profile.church_id);
  if (result.error) return { success: false, message: result.error };
  return { success: true, data: result.data ?? undefined };
}

export async function updateChurchAction(
  values: UpdateChurchFormValues,
): Promise<SettingsActionResult> {
  try {
    updateChurchSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };
  if (!(await hasPermission(PERMISSION_CODES.SETTINGS_UPDATE))) {
    return { success: false, message: "You do not have permission to update church settings." };
  }
  if (!(await isChurchAdminOrPlatformOwner())) {
    return { success: false, message: "You do not have permission to update church settings." };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();
  if (!profile?.church_id) {
    return { success: false, message: "Church not found." };
  }
  const existing = await settingsService.getChurchSettings(supabase, profile.church_id);
  const oldValues = existing.data ?? undefined;
  const result = await settingsService.updateChurch(supabase, profile.church_id, {
    nameAr: values.nameAr,
    nameEn: values.nameEn,
    contactEmail: values.contactEmail,
    contactPhone: values.contactPhone,
    addressAr: values.addressAr,
    addressEn: values.addressEn,
    logoUrl: values.logoUrl,
  });
  if (result.error) return { success: false, message: result.error };
  await writeAuditLog(supabase, "update", "church", profile.church_id, oldValues, values);
  return { success: true, message: "Church settings updated successfully." };
}

export async function changePasswordAction(
  values: ChangePasswordFormValues,
): Promise<SettingsActionResult> {
  try {
    changePasswordSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };
  if (!(await hasPermission(PERMISSION_CODES.SETTINGS_READ))) {
    return { success: false, message: "You do not have permission to view settings." };
  }
  const result = await updatePassword(values.newPassword);
  if (!result.success) {
    return { success: false, message: result.error ?? "Failed to change password." };
  }
  await writeAuditLog(supabase, "update", "password", user.id, undefined, {
    changed_at: new Date().toISOString(),
  });
  return { success: true, message: "Password changed successfully." };
}