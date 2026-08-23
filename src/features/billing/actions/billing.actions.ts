"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { sendNotification } from "@/features/notifications";
import type { Json } from "@/types/database.types";
import type { PaidPlan, BillingActionResult } from "../types/billing.types";
import { PLAN_PRICES } from "../types/billing.types";
import {
  hasPendingPaymentRequest,
  getChurchBillingSummary,
  getPlatformBillingStats,
} from "../services/billing.service";

// ============================================================================
// Church Manager Actions
// ============================================================================

/**
 * Platform owners sit OUTSIDE the church subscription model: they administer
 * billing for churches but are never a subscribing customer themselves.
 * Customer actions must reject them server-side (not just hide the UI).
 */
async function rejectIfPlatformOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ success: false; message: string } | null> {
  const { data: isOwner } = await supabase.rpc("user_is_platform_owner");
  if (isOwner) {
    return {
      success: false,
      message:
        "Platform owners do not have a church subscription and cannot use customer billing actions.",
    };
  }
  return null;
}

export async function getBillingSummaryAction(): Promise<BillingActionResult<
  Awaited<ReturnType<typeof getChurchBillingSummary>>["data"]
>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const ownerRejection = await rejectIfPlatformOwner(supabase);
  if (ownerRejection) return ownerRejection;

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) return { success: false, message: "Profile not found." };

  const result = await getChurchBillingSummary(supabase, profile.church_id);
  return { success: !result.error, data: result.data, message: result.error ?? undefined };
}

export async function submitPaymentRequestAction(input: {
  plan: PaidPlan;
  transferDate?: string;
  paymentReference?: string;
  note?: string;
}): Promise<BillingActionResult<{ requestId: string }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const ownerRejection = await rejectIfPlatformOwner(supabase);
  if (ownerRejection) return ownerRejection;

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) return { success: false, message: "Profile not found." };

  // Check for duplicate pending request
  const hasPending = await hasPendingPaymentRequest(supabase, profile.church_id);
  if (hasPending) {
    return {
      success: false,
      message: "You already have a pending payment request. Please wait for it to be reviewed before submitting a new one.",
    };
  }

  const price = PLAN_PRICES[input.plan];

  const { data, error } = await supabase
    .from("payment_requests")
    .insert({
      church_id: profile.church_id,
      requested_by: user.id,
      plan: input.plan,
      amount: price.amount,
      currency: price.currency,
      transfer_date: input.transferDate || null,
      payment_reference: input.paymentReference || null,
      note: input.note || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { success: false, message: error.message };

  // Audit log
  await writeAuditLog(supabase, "payment_request_submitted", "payment_request", data.id, null, {
    plan: input.plan,
    amount: price.amount,
  });

  // Notify platform owner(s)
  await notifyPlatformOwners("payment_request_submitted", {
    churchId: profile.church_id,
    plan: input.plan,
    amount: price.amount,
  });

  return { success: true, data: { requestId: data.id } };
}

export async function cancelPaymentRequestAction(
  requestId: string,
): Promise<BillingActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const ownerRejection = await rejectIfPlatformOwner(supabase);
  if (ownerRejection) return ownerRejection;

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) return { success: false, message: "Profile not found." };

  const { data: existing, error: fetchError } = await supabase
    .from("payment_requests")
    .select("id, status, church_id")
    .eq("id", requestId)
    .single();

  if (fetchError || !existing) return { success: false, message: "Payment request not found." };
  if (existing.church_id !== profile.church_id) return { success: false, message: "Not authorized." };
  if (existing.status !== "pending") return { success: false, message: "Only pending requests can be cancelled." };

  const { error } = await supabase
    .from("payment_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId);

  if (error) return { success: false, message: error.message };

  await writeAuditLog(supabase, "payment_request_cancelled", "payment_request", requestId, { status: "pending" }, { status: "cancelled" });

  return { success: true };
}

export async function requestRefundAction(input: {
  paymentRequestId: string;
  invoiceId?: string;
  reason: string;
}): Promise<BillingActionResult<{ refundId: string }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const ownerRejection = await rejectIfPlatformOwner(supabase);
  if (ownerRejection) return ownerRejection;

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile) return { success: false, message: "Profile not found." };

  const { data, error } = await supabase
    .from("refunds")
    .insert({
      church_id: profile.church_id,
      payment_request_id: input.paymentRequestId,
      invoice_id: input.invoiceId || null,
      reason: input.reason,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { success: false, message: error.message };

  await writeAuditLog(supabase, "refund_requested", "refund", data.id, null, {
    paymentRequestId: input.paymentRequestId,
    reason: input.reason,
  });

  await notifyPlatformOwners("refund_requested", {
    churchId: profile.church_id,
    refundId: data.id,
  });

  return { success: true, data: { refundId: data.id } };
}

// ============================================================================
// Platform Owner Actions
// ============================================================================

async function requirePlatformOwner(supabase: Awaited<ReturnType<typeof createClient>>): Promise<BillingActionResult & { isOwner: boolean; userId: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated.", isOwner: false, userId: null };

  const { data: isOwner } = await supabase.rpc("user_is_platform_owner");
  if (!isOwner) return { success: false, message: "Not authorized. Platform owner access required.", isOwner: false, userId: null };

  return { success: true, isOwner: true, userId: user.id };
}

export async function approvePaymentAction(
  requestId: string,
  reviewerNotes?: string,
): Promise<BillingActionResult> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const auth = await requirePlatformOwner(supabase);
  if (!auth.isOwner) return auth;

  const { data: request, error: fetchError } = await admin
    .from("payment_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) return { success: false, message: "Payment request not found." };
  if (request.status !== "pending") return { success: false, message: "Request is not pending." };

  const now = new Date().toISOString();
  const plan = request.plan as PaidPlan;

  // Calculate subscription period
  const subscriptionStart = new Date();
  const subscriptionEnd = new Date();
  if (plan === "monthly") {
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
  } else {
    subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
  }

  // Update payment request
  const { error: updateError } = await admin
    .from("payment_requests")
    .update({
      status: "approved",
      reviewed_by: auth.userId,
      reviewed_at: now,
      reviewer_notes: reviewerNotes || null,
    })
    .eq("id", requestId);

  if (updateError) return { success: false, message: updateError.message };

  // Generate invoice number
  const { data: invoiceNumber, error: invNumError } = await admin.rpc("generate_invoice_number");
  if (invNumError) return { success: false, message: "Failed to generate invoice number." };

  // Create invoice
  const { error: invoiceError } = await admin
    .from("invoices")
    .insert({
      church_id: request.church_id,
      payment_request_id: requestId,
      invoice_number: invoiceNumber as string,
      plan: request.plan,
      amount: request.amount,
      currency: request.currency,
      payment_method: request.payment_method,
      paid_at: now,
      subscription_start: subscriptionStart.toISOString(),
      subscription_end: subscriptionEnd.toISOString(),
      status: "issued",
    });

  if (invoiceError) return { success: false, message: invoiceError.message };

  // Update church subscription
  const { error: churchError } = await admin
    .from("churches")
    .update({
      subscription_tier: plan,
      subscription_status: "active",
      subscription_expires_at: subscriptionEnd.toISOString(),
      trial_used: true,
    })
    .eq("id", request.church_id);

  if (churchError) return { success: false, message: churchError.message };

  // Audit
  await writeAuditLog(supabase, "payment_approved", "payment_request", requestId, { status: "pending" }, {
    status: "approved",
    plan,
    amount: request.amount,
  });

  // Notify church manager
  await notifyChurchUser(admin, request.church_id, request.requested_by, "payment_approved", {
    plan,
    amount: request.amount,
    invoiceNumber: invoiceNumber as string,
  });

  return { success: true };
}

export async function rejectPaymentAction(
  requestId: string,
  reason: string,
): Promise<BillingActionResult> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const auth = await requirePlatformOwner(supabase);
  if (!auth.isOwner) return auth;

  const { data: request, error: fetchError } = await admin
    .from("payment_requests")
    .select("id, status, church_id, requested_by, plan, amount")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) return { success: false, message: "Payment request not found." };
  if (request.status !== "pending") return { success: false, message: "Request is not pending." };

  const { error } = await admin
    .from("payment_requests")
    .update({
      status: "rejected",
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reason,
    })
    .eq("id", requestId);

  if (error) return { success: false, message: error.message };

  await writeAuditLog(supabase, "payment_rejected", "payment_request", requestId, { status: "pending" }, {
    status: "rejected",
    reason,
  });

  await notifyChurchUser(admin, request.church_id, request.requested_by, "payment_rejected", {
    plan: request.plan,
    amount: request.amount,
    reason,
  });

  return { success: true };
}

export async function approveRefundAction(
  refundId: string,
  reviewerNotes?: string,
): Promise<BillingActionResult> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const auth = await requirePlatformOwner(supabase);
  if (!auth.isOwner) return auth;

  const { data: refund, error: fetchError } = await admin
    .from("refunds")
    .select("*")
    .eq("id", refundId)
    .single();

  if (fetchError || !refund) return { success: false, message: "Refund not found." };
  if (refund.status !== "pending") return { success: false, message: "Refund is not pending." };

  const { error } = await admin
    .from("refunds")
    .update({
      status: "approved",
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewerNotes || null,
    })
    .eq("id", refundId);

  if (error) return { success: false, message: error.message };

  await writeAuditLog(supabase, "refund_approved", "refund", refundId, { status: "pending" }, { status: "approved" });

  return { success: true };
}

export async function rejectRefundAction(
  refundId: string,
  reason: string,
): Promise<BillingActionResult> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const auth = await requirePlatformOwner(supabase);
  if (!auth.isOwner) return auth;

  const { data: refund, error: fetchError } = await admin
    .from("refunds")
    .select("id, status, church_id")
    .eq("id", refundId)
    .single();

  if (fetchError || !refund) return { success: false, message: "Refund not found." };
  if (refund.status !== "pending") return { success: false, message: "Refund is not pending." };

  const { error } = await admin
    .from("refunds")
    .update({
      status: "rejected",
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reason,
    })
    .eq("id", refundId);

  if (error) return { success: false, message: error.message };

  await writeAuditLog(supabase, "refund_rejected", "refund", refundId, { status: "pending" }, { status: "rejected", reason });

  return { success: true };
}

export async function completeRefundAction(
  refundId: string,
  refundReference: string,
): Promise<BillingActionResult> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const auth = await requirePlatformOwner(supabase);
  if (!auth.isOwner) return auth;

  const { data: refund, error: fetchError } = await admin
    .from("refunds")
    .select("*")
    .eq("id", refundId)
    .single();

  if (fetchError || !refund) return { success: false, message: "Refund not found." };
  if (refund.status !== "approved") return { success: false, message: "Refund must be approved first." };

  const { error } = await admin
    .from("refunds")
    .update({
      status: "completed",
      refund_reference: refundReference,
      completed_at: new Date().toISOString(),
      completed_by: auth.userId,
    })
    .eq("id", refundId);

  if (error) return { success: false, message: error.message };

  // Void the associated invoice if one exists
  if (refund.invoice_id) {
    await admin
      .from("invoices")
      .update({ status: "void" })
      .eq("id", refund.invoice_id);
  }

  // Downgrade church subscription to free
  const { error: churchError } = await admin
    .from("churches")
    .update({
      subscription_tier: "free",
      subscription_status: "active",
      subscription_expires_at: null,
    })
    .eq("id", refund.church_id);

  if (churchError) return { success: false, message: churchError.message };

  await writeAuditLog(supabase, "refund_completed", "refund", refundId, { status: "approved" }, { status: "completed", refundReference });

  // Notify the original payment requester
  if (refund.payment_request_id) {
    const { data: originalRequest } = await admin
      .from("payment_requests")
      .select("requested_by")
      .eq("id", refund.payment_request_id)
      .single();

    if (originalRequest?.requested_by) {
      await notifyChurchUser(admin, refund.church_id, originalRequest.requested_by, "refund_completed", {
        refundId,
        refundReference,
      });
    }
  }

  return { success: true };
}

export async function activateSubscriptionAction(
  churchId: string,
  plan: PaidPlan,
  durationMonths: number,
): Promise<BillingActionResult> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const auth = await requirePlatformOwner(supabase);
  if (!auth.isOwner) return auth;

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

  const { error } = await admin
    .from("churches")
    .update({
      subscription_tier: plan,
      subscription_status: "active",
      subscription_expires_at: expiresAt.toISOString(),
    })
    .eq("id", churchId);

  if (error) return { success: false, message: error.message };

  await writeAuditLog(supabase, "subscription_activated_manual", "church", churchId, null, {
    plan,
    durationMonths,
    expiresAt: expiresAt.toISOString(),
  });

  return { success: true };
}

export async function deactivateSubscriptionAction(
  churchId: string,
): Promise<BillingActionResult> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const auth = await requirePlatformOwner(supabase);
  if (!auth.isOwner) return auth;

  const { error } = await admin
    .from("churches")
    .update({
      subscription_tier: "free",
      subscription_status: "active",
      subscription_expires_at: null,
    })
    .eq("id", churchId);

  if (error) return { success: false, message: error.message };

  await writeAuditLog(supabase, "subscription_deactivated_manual", "church", churchId, null, {
    newTier: "free",
  });

  return { success: true };
}

export async function extendSubscriptionAction(
  churchId: string,
  additionalDays: number,
  reason: string,
): Promise<BillingActionResult> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const auth = await requirePlatformOwner(supabase);
  if (!auth.isOwner) return auth;

  const { data: church, error: fetchError } = await admin
    .from("churches")
    .select("subscription_expires_at")
    .eq("id", churchId)
    .single();

  if (fetchError || !church) return { success: false, message: "Church not found." };

  const currentExpiry = church.subscription_expires_at
    ? new Date(church.subscription_expires_at)
    : new Date();

  if (currentExpiry < new Date()) {
    currentExpiry.setTime(Date.now());
  }

  currentExpiry.setDate(currentExpiry.getDate() + additionalDays);

  const { error } = await admin
    .from("churches")
    .update({
      subscription_expires_at: currentExpiry.toISOString(),
      subscription_status: "active",
    })
    .eq("id", churchId);

  if (error) return { success: false, message: error.message };

  await writeAuditLog(supabase, "subscription_extended", "church", churchId, null, {
    additionalDays,
    reason,
    newExpiry: currentExpiry.toISOString(),
  });

  return { success: true };
}

// ============================================================================
// Helpers
// ============================================================================

async function notifyPlatformOwners(
  notificationType: string,
  data: Record<string, Json>,
): Promise<void> {
  try {
    const admin = createAdminClient();

    // Find platform owner profiles
    const { data: platformOwnerRoles } = await admin
      .from("roles")
      .select("id")
      .is("church_id", null)
      .eq("role_type", "platform_owner");

    if (!platformOwnerRoles || platformOwnerRoles.length === 0) return;

    const roleIds = platformOwnerRoles.map((r) => r.id);

    const { data: userRoles } = await admin
      .from("user_roles")
      .select("user_id")
      .is("church_id", null)
      .in("role_id", roleIds)
      .is("end_date", null);

    if (!userRoles || userRoles.length === 0) return;

    for (const ur of userRoles) {
      await sendNotification({
        churchId: null,
        recipientId: ur.user_id,
        notificationType,
        titleAr: getNotificationTitleAr(notificationType),
        titleEn: getNotificationTitleEn(notificationType),
        bodyAr: getNotificationBodyAr(notificationType, data),
        bodyEn: getNotificationBodyEn(notificationType, data),
        data,
        channel: "in_app",
      });
    }
  } catch {
    // Notification failure should not break the main action
  }
}

async function notifyChurchUser(
  admin: ReturnType<typeof createAdminClient>,
  churchId: string,
  recipientId: string,
  notificationType: string,
  data: Record<string, Json>,
): Promise<void> {
  try {
    await sendNotification({
      churchId,
      recipientId,
      notificationType,
      titleAr: getNotificationTitleAr(notificationType),
      titleEn: getNotificationTitleEn(notificationType),
      bodyAr: getNotificationBodyAr(notificationType, data),
      bodyEn: getNotificationBodyEn(notificationType, data),
      data,
      channel: "in_app",
    });
  } catch {
    // Notification failure should not break the main action
  }
}

function getNotificationTitleAr(type: string): string {
  const titles: Record<string, string> = {
    payment_request_submitted: "طلب دفع جديد",
    payment_approved: "تم الموافقة على طلب الدفع",
    payment_rejected: "تم رفض طلب الدفع",
    refund_requested: "طلب استرداد جديد",
    refund_approved: "تم الموافقة على طلب الاسترداد",
    refund_rejected: "تم رفض طلب الاسترداد",
    refund_completed: "تم إتمام عملية الاسترداد",
  };
  return titles[type] ?? "إشعار";
}

function getNotificationTitleEn(type: string): string {
  const titles: Record<string, string> = {
    payment_request_submitted: "New Payment Request",
    payment_approved: "Payment Approved",
    payment_rejected: "Payment Rejected",
    refund_requested: "Refund Requested",
    refund_approved: "Refund Approved",
    refund_rejected: "Refund Rejected",
    refund_completed: "Refund Completed",
  };
  return titles[type] ?? "Notification";
}

function getNotificationBodyAr(type: string, data: Record<string, Json>): string {
  const bodies: Record<string, string> = {
    payment_request_submitted: `تم إرسال طلب دفع جديد بقيمة ${data.amount ?? ""} ج.م`,
    payment_approved: `تم الموافقة على طلب الدفع وإنشاء الفاتورة. الخطة: ${data.plan ?? ""}`,
    payment_rejected: `تم رفض طلب الدفع. السبب: ${data.reason ?? "لم يُحدد"}`,
    refund_requested: "تم إرسال طلب استرداد جديد للمراجعة",
    refund_approved: "تم الموافقة على طلب الاسترداد. يُرجى إتمام العملية يدوياً",
    refund_rejected: `تم رفض طلب الاسترداد. السبب: ${data.reason ?? "لم يُحدد"}`,
    refund_completed: "تم إتمام عملية الاسترداد بنجاح",
  };
  return bodies[type] ?? "";
}

function getNotificationBodyEn(type: string, data: Record<string, Json>): string {
  const bodies: Record<string, string> = {
    payment_request_submitted: `New payment request submitted for ${data.amount ?? ""} EGP`,
    payment_approved: `Your payment has been approved and invoice created. Plan: ${data.plan ?? ""}`,
    payment_rejected: `Your payment request was rejected. Reason: ${data.reason ?? "Not specified"}`,
    refund_requested: "A new refund request has been submitted for review",
    refund_approved: "Your refund has been approved. Please complete the process manually.",
    refund_rejected: `Your refund request was rejected. Reason: ${data.reason ?? "Not specified"}`,
    refund_completed: "Your refund has been completed successfully",
  };
  return bodies[type] ?? "";
}

// ============================================================================
// Platform Billing Stats
// ============================================================================

export async function getPlatformBillingStatsAction(): Promise<BillingActionResult<
  Awaited<ReturnType<typeof getPlatformBillingStats>>["data"]
>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const ownerCheck = await requirePlatformOwner(supabase);
  if (!ownerCheck.isOwner) {
    return { success: false, message: ownerCheck.message };
  }

  const adminSupabase = createAdminClient();
  const result = await getPlatformBillingStats(adminSupabase);
  return { success: !result.error, data: result.data, message: result.error ?? undefined };
}
