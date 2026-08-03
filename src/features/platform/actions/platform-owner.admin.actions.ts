"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  bootstrapPlatformOwner,
  hasExistingPlatformOwner,
} from "../services/platform-owner.service";
import type { RegistrationError } from "@/types/registration";

export type PlatformOwnerBootstrapActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};

export type BootstrapPlatformOwnerActionInput = {
  email: string;
  fullNameAr: string;
  phone?: string | null;
  bootstrapToken?: string | null;
};

function toErrorMessage(error: RegistrationError): string {
  switch (error.code) {
    case "platform_owner_already_exists":
      return "A platform owner has already been provisioned.";
    case "platform_owner_role_not_found":
      return "The platform owner role could not be created.";
    case "auth_user_not_found":
      return "The platform owner auth account could not be provisioned.";
    case "email_required":
      return "A valid email address is required.";
    case "applicant_name_required":
      return "The platform owner's full name (Arabic) is required.";
    default:
      return error.message;
  }
}

/**
 * One-time Platform Owner bootstrap (P0-3 / F3).
 *
 * Security model — no PO exists yet, so this cannot be gated on an RBAC
 * permission. It is gated by:
 *   1. PLATFORM_OWNER_BOOTSTRAP_TOKEN (env) matching the caller-supplied token.
 *   2. A DB pre-check that no global role grant exists yet.
 *   3. The RPC's authoritative single-flight guard (platform_owner_already_exists)
 *      plus service_role-only EXECUTE (026 S7/S8).
 *
 * Flow mirrors approve_church_requestAction: create the auth account via the
 * service-role admin client, then let the SECURITY DEFINER RPC do the grants;
 * on any failure the created auth account is deleted.
 */
export async function bootstrapPlatformOwnerAction(
  input: BootstrapPlatformOwnerActionInput,
): Promise<PlatformOwnerBootstrapActionResult<{ roleId: string; inviteLink: string | null }>> {
  const expectedToken = process.env.PLATFORM_OWNER_BOOTSTRAP_TOKEN;

  if (!expectedToken) {
    return {
      success: false,
      message:
        "Platform owner bootstrap is not enabled. Set PLATFORM_OWNER_BOOTSTRAP_TOKEN.",
    };
  }

  if (input.bootstrapToken !== expectedToken) {
    return { success: false, message: "Invalid bootstrap token." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { success: false, message: "Missing SUPABASE_SERVICE_ROLE_KEY." };
  }

  if (await hasExistingPlatformOwner(admin)) {
    return { success: false, message: "A platform owner has already been provisioned." };
  }

  const email = input.email?.trim().toLowerCase();
  const fullNameAr = input.fullNameAr?.trim();

  if (!email) {
    return { success: false, message: "A valid email address is required." };
  }
  if (!fullNameAr) {
    return { success: false, message: "The platform owner's full name (Arabic) is required." };
  }

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    return {
      success: false,
      message: "An account already exists for this email. Bootstrap was not run.",
    };
  }

  const isProd = process.env.NODE_ENV === "production";

  let authUserId: string | null = null;
  let inviteLink: string | null = null;

  try {
    const { data: authData, error: authError } = isProd
      ? await admin.auth.admin.createUser({
          email,
          email_confirm: false,
          user_metadata: { full_name_ar: fullNameAr },
        })
      : await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name_ar: fullNameAr },
        });

    if (authError || !authData.user) {
      return {
        success: false,
        message: authError?.message ?? "Failed to provision the platform owner account.",
      };
    }

    authUserId = authData.user.id;

    const result = await bootstrapPlatformOwner(admin, {
      authUserId,
      fullNameAr,
      email,
      phone: input.phone ?? null,
    });

    if (result.error || !result.data) {
      throw new Error(result.error ? toErrorMessage(result.error) : "Bootstrap returned no role.");
    }

    if (isProd) {
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

    return { success: true, data: { roleId: result.data, inviteLink } };
  } catch (error) {
    if (authUserId) {
      await admin.auth.admin.deleteUser(authUserId);
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to bootstrap the platform owner.",
    };
  }
}
