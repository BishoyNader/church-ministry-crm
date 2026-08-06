"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import { ZodError } from "zod";
import { provisionChurchWizardSchema } from "../schemas/provisioning.schema";
import type { ProvisionChurchWizardValues } from "../schemas/provisioning.schema";
import { provisionChurch, createChurchSuperAdmin } from "../services/provisioning.service";
import { generateSlug, ensureUniqueSlug } from "@/lib/utils/slug";

const KNOWN_PROVISIONING_RPC_ERRORS = new Set<string>([
  "not_authenticated",
  "not_platform_owner",
  "church_name_required",
  "slug_required",
  "auth_user_id_required",
  "full_name_ar_required",
  "email_required",
  "invalid_slug",
  "church_name_exists",
  "auth_user_not_found",
  "auth_user_email_mismatch",
  "super_admin_role_not_found",
]);

export type ProvisionChurchWizardResult = {
  success: boolean;
  message: string;
  code?: string;
  data?: { churchId: string; inviteLink: string | null };
};

function isKnownRpcError(message: string | null | undefined): boolean {
  return typeof message === "string" && KNOWN_PROVISIONING_RPC_ERRORS.has(message);
}

export async function provisionChurchAction(input: {
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
}) {
  try {
    const supabase = await createClient();
    const result = await provisionChurch(
      supabase as unknown as Parameters<typeof provisionChurch>[0],
      input,
    );

    if (!result.data) {
      return { success: false, message: result.error ?? "Failed to provision church." };
    }

    return { success: true, data: result.data };
  } catch {
    return { success: false, message: "Failed to provision church." };
  }
}

export async function createChurchSuperAdminAction(input: {
  churchId: string;
  authUserId: string;
  fullNameAr: string;
  fullNameEn?: string;
  email: string;
  phone?: string;
}) {
  try {
    const supabase = await createClient();
    const result = await createChurchSuperAdmin(
      supabase as unknown as Parameters<typeof createChurchSuperAdmin>[0],
      input,
    );

    if (!result.data) {
      return { success: false, message: result.error ?? "Failed to create church super admin." };
    }

    return { success: true, data: result.data };
  } catch {
    return { success: false, message: "Failed to create church super admin." };
  }
}

export async function provisionChurchWizardAction(
  values: ProvisionChurchWizardValues,
): Promise<ProvisionChurchWizardResult> {
  let parsed;
  try {
    parsed = provisionChurchWizardSchema.parse(values);
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        message: "Please fix the highlighted fields.",
        code: "validation_error",
      };
    }
    return {
      success: false,
      message: "An unexpected validation error occurred.",
      code: "validation_error",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in.", code: "not_authenticated" };
  }

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_CREATE))) {
    return {
      success: false,
      message: "Only a platform owner can provision churches.",
      code: "not_platform_owner",
    };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return {
      success: false,
      message: "Server configuration is missing a service role.",
      code: "missing_service_role",
    };
  }

  const email = parsed.email.trim().toLowerCase();
  const fullNameAr = parsed.fullNameAr.trim();
  const fullNameEn = parsed.fullNameEn.trim();
  const churchNameAr = parsed.churchNameAr.trim();
  const churchNameEn = parsed.churchNameEn.trim();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    return {
      success: false,
      message: "An account already exists for this email.",
      code: "auth_user_exists",
    };
  }

  const isProd = process.env.NODE_ENV === "production";

  let authUserId: string | null = null;
  let inviteLink: string | null = null;

  try {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: parsed.password || undefined,
      email_confirm: isProd ? false : true,
      user_metadata: {
        full_name_ar: fullNameAr,
        full_name_en: fullNameEn || undefined,
      },
    });

    if (authError || !authData.user) {
      return {
        success: false,
        message: authError?.message ?? "Failed to create the account.",
        code: "auth_user_create_failed",
      };
    }

    authUserId = authData.user.id;

    const baseSlug =
      parsed.slug.trim() || generateSlug(churchNameEn || churchNameAr);
    const slug = await ensureUniqueSlug(
      supabase as unknown as Parameters<typeof ensureUniqueSlug>[0],
      baseSlug,
    );

    const result = await provisionChurch(
      supabase as unknown as Parameters<typeof provisionChurch>[0],
      {
        churchNameAr,
        churchNameEn: churchNameEn || undefined,
        slug,
        contactEmail: parsed.contactEmail.trim() || undefined,
        contactPhone: parsed.contactPhone.trim() || undefined,
        addressAr: parsed.addressAr.trim() || undefined,
        authUserId,
        fullNameAr,
        fullNameEn: fullNameEn || undefined,
        email,
        phone: parsed.phone.trim() || undefined,
      },
    );

    if (result.error || !result.data) {
      const code = isKnownRpcError(result.error) ? (result.error as string) : "provision_failed";
      throw new Error(code);
    }

    if (isProd && !parsed.password) {
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          redirectTo: process.env.NEXT_PUBLIC_APP_URL
            ? `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`
            : undefined,
        },
      });

      if (!linkError && link?.properties?.hashed_token) {
        inviteLink = link.properties.action_link ?? null;
      }
    }

    return {
      success: true,
      message: "Church provisioned successfully.",
      data: { churchId: result.data.churchId, inviteLink },
    };
  } catch (error) {
    if (authUserId) {
      await admin.auth.admin.deleteUser(authUserId);
    }
    const code = error instanceof Error ? error.message : "provision_failed";
    return { success: false, message: code, code };
  }
}
