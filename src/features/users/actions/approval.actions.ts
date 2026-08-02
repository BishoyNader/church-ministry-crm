"use server";

import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import {
  approveServant,
  rejectServant,
  listPendingRegistrations,
  type PendingRegistration,
} from "../services/approval.service";

export type ApprovalActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};

async function getActorChurchId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, userId: null, churchId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  return { supabase, userId: user.id, churchId: profile?.church_id ?? null };
}

export async function listPendingRegistrationsAction(): Promise<
  ApprovalActionResult<PendingRegistration[]>
> {
  const { supabase, churchId } = await getActorChurchId();

  if (!churchId) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.SERVANTS_APPROVE))) {
    return { success: false, message: "You do not have permission to review registrations." };
  }

  const result = await listPendingRegistrations(supabase, churchId);

  if (result.error) {
    return { success: false, message: result.error.message };
  }

  return { success: true, data: result.data ?? undefined };
}

export async function approveServantAction(servantId: string): Promise<ApprovalActionResult> {
  const { supabase, churchId } = await getActorChurchId();

  if (!churchId) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.SERVANTS_APPROVE))) {
    return { success: false, message: "You do not have permission to review registrations." };
  }

  const result = await approveServant(supabase, servantId);

  if (result.error) {
    return { success: false, message: result.error.message };
  }

  return { success: true, message: "Registration approved." };
}

export async function rejectServantAction(
  servantId: string,
  reason?: string | null,
): Promise<ApprovalActionResult> {
  const { supabase, churchId } = await getActorChurchId();

  if (!churchId) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.SERVANTS_APPROVE))) {
    return { success: false, message: "You do not have permission to review registrations." };
  }

  const result = await rejectServant(supabase, servantId, reason);

  if (result.error) {
    return { success: false, message: result.error.message };
  }

  return { success: true, message: "Registration rejected." };
}
