"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import {
  approveChurchRequest,
  rejectChurchRequest,
  buildUniqueChurchSlug,
} from "../services/provisioning.service";
import type { ChurchRequestRow, ChurchRequestStatus } from "../types/church-request.admin.types";
import type { RegistrationError } from "@/types/registration";

export type ChurchRequestAdminActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};

function toErrorMessage(error: RegistrationError): string {
  switch (error.code) {
    case "request_not_found":
      return "Request not found.";
    case "request_not_pending":
      return "This request has already been reviewed.";
    case "not_platform_owner":
      return "Only a platform owner can review church requests.";
    case "church_name_exists":
      return "A church with this name already exists.";
    case "auth_user_not_found":
    case "auth_user_email_mismatch":
      return "The applicant account could not be provisioned.";
    case "invalid_slug":
      return "The generated church slug is invalid.";
    case "super_admin_role_not_found":
      return "The initial administrator role could not be created.";
    default:
      return error.message;
  }
}

async function assertPlatformOwner(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  if (!(await hasPermission(PERMISSION_CODES.TENANTS_READ))) {
    return null;
  }

  return { supabase, userId: user.id };
}

export async function listChurchRequestsAction(
  status: ChurchRequestStatus,
): Promise<ChurchRequestAdminActionResult<ChurchRequestRow[]>> {
  const actor = await assertPlatformOwner();
  if (!actor) {
    return { success: false, message: "Only a platform owner can view church requests." };
  }

  const { supabase } = actor;

  const { data, error } = await supabase
    .from("church_requests")
    .select(
      "id, church_name_ar, catechist_name, applicant_name, email, phone, notes, status, reviewed_by, reviewed_at, decision_notes, created_at, updated_at",
    )
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, data: (data ?? []) as ChurchRequestRow[] };
}

export async function approveChurchRequestAction(
  requestId: string,
): Promise<ChurchRequestAdminActionResult<{ inviteLink: string | null }>> {
  const actor = await assertPlatformOwner();
  if (!actor) {
    return { success: false, message: "Only a platform owner can approve church requests." };
  }

  const { supabase } = actor;
  const admin = createAdminClient();

  const { data: request } = await supabase
    .from("church_requests")
    .select("id, church_name_ar, email")
    .eq("id", requestId)
    .eq("status", "pending")
    .single();

  if (!request) {
    return { success: false, message: "This request could not be found or has been reviewed." };
  }

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", request.email)
    .maybeSingle();

  if (existingProfile) {
    return {
      success: false,
      message: "An account already exists for this email. Reject the request instead.",
    };
  }

  const isProd = process.env.NODE_ENV === "production";

  let authUserId: string | null = null;
  let inviteLink: string | null = null;

  try {
    const { data: authData, error: authError } = isProd
      ? await admin.auth.admin.createUser({
          email: request.email,
          email_confirm: false,
          user_metadata: { full_name_ar: request.church_name_ar },
        })
      : await admin.auth.admin.createUser({
          email: request.email,
          email_confirm: true,
          user_metadata: { full_name_ar: request.church_name_ar },
        });

    if (authError || !authData.user) {
      return {
        success: false,
        message: authError?.message ?? "Failed to provision the applicant account.",
      };
    }

    authUserId = authData.user.id;

    const slug = await buildUniqueChurchSlug(admin, request.church_name_ar);

    const result = await approveChurchRequest(supabase, requestId, authUserId, slug);

    if (result.error) {
      throw new Error(toErrorMessage(result.error));
    }

    if (isProd) {
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({
        type: "invite",
        email: request.email,
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

    return { success: true, data: { inviteLink } };
  } catch (error) {
    if (authUserId) {
      await admin.auth.admin.deleteUser(authUserId);
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to approve church request.",
    };
  }
}

export async function rejectChurchRequestAction(
  requestId: string,
  reason?: string | null,
): Promise<ChurchRequestAdminActionResult> {
  const actor = await assertPlatformOwner();
  if (!actor) {
    return { success: false, message: "Only a platform owner can reject church requests." };
  }

  const { supabase } = actor;
  const result = await rejectChurchRequest(supabase, requestId, reason);

  if (result.error) {
    return { success: false, message: toErrorMessage(result.error) };
  }

  return { success: true, message: "Church request rejected." };
}
