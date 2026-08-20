import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  PaymentRequestRow,
  PaymentRequestsPageData,
  InvoicesPageData,
  RefundsPageData,
  ChurchBillingSummary,
  PlatformBillingStats,
} from "../types/billing.types";

type ServiceResult<T> = { data: T | null; error: string | null };

const DEFAULT_PAGE_SIZE = 20;

// ============================================================================
// Payment Request Services
// ============================================================================

export async function getChurchPaymentRequests(
  supabase: SupabaseClient<Database>,
  churchId: string,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<ServiceResult<PaymentRequestsPageData>> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("payment_requests")
    .select("*", { count: "exact" })
    .eq("church_id", churchId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return { data: null, error: error.message };

  return {
    data: {
      rows: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    },
    error: null,
  };
}

export async function getPendingPaymentRequests(
  supabase: SupabaseClient<Database>,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<ServiceResult<PaymentRequestsPageData>> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("payment_requests")
    .select(`
      *,
      profiles!payment_requests_requested_by_fkey(full_name_ar, full_name_en, email)
    `, { count: "exact" })
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .range(from, to);

  if (error) return { data: null, error: error.message };

  return {
    data: {
      rows: (data as unknown as PaymentRequestRow[]) ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    },
    error: null,
  };
}

export async function getAllPaymentRequests(
  supabase: SupabaseClient<Database>,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  status?: string,
): Promise<ServiceResult<PaymentRequestsPageData>> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("payment_requests")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) return { data: null, error: error.message };

  return {
    data: {
      rows: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    },
    error: null,
  };
}

export async function hasPendingPaymentRequest(
  supabase: SupabaseClient<Database>,
  churchId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("payment_requests")
    .select("id", { count: "exact", head: true })
    .eq("church_id", churchId)
    .eq("status", "pending");

  return (count ?? 0) > 0;
}

// ============================================================================
// Invoice Services
// ============================================================================

export async function getChurchInvoices(
  supabase: SupabaseClient<Database>,
  churchId: string,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<ServiceResult<InvoicesPageData>> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("invoices")
    .select("*", { count: "exact" })
    .eq("church_id", churchId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return { data: null, error: error.message };

  return {
    data: {
      rows: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    },
    error: null,
  };
}

export async function getAllInvoices(
  supabase: SupabaseClient<Database>,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<ServiceResult<InvoicesPageData>> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("invoices")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return { data: null, error: error.message };

  return {
    data: {
      rows: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    },
    error: null,
  };
}

// ============================================================================
// Refund Services
// ============================================================================

export async function getChurchRefunds(
  supabase: SupabaseClient<Database>,
  churchId: string,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<ServiceResult<RefundsPageData>> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("refunds")
    .select("*", { count: "exact" })
    .eq("church_id", churchId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return { data: null, error: error.message };

  return {
    data: {
      rows: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    },
    error: null,
  };
}

// ============================================================================
// Church Billing Summary
// ============================================================================

export async function getChurchBillingSummary(
  supabase: SupabaseClient<Database>,
  churchId: string,
): Promise<ServiceResult<ChurchBillingSummary>> {
  const { data: church, error: churchError } = await supabase
    .from("churches")
    .select("id, name_ar, subscription_tier, subscription_status, trial_ends_at, subscription_expires_at, trial_used")
    .eq("id", churchId)
    .single();

  if (churchError || !church) return { data: null, error: churchError?.message ?? "Church not found" };

  const { count: pendingCount } = await supabase
    .from("payment_requests")
    .select("id", { count: "exact", head: true })
    .eq("church_id", churchId)
    .eq("status", "pending");

  const { count: invoiceCount } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("church_id", churchId);

  return {
    data: {
      churchId: church.id,
      churchNameAr: church.name_ar,
      plan: church.subscription_tier as ChurchBillingSummary["plan"],
      status: church.subscription_status as ChurchBillingSummary["status"],
      trialEndsAt: church.trial_ends_at,
      subscriptionExpiresAt: church.subscription_expires_at,
      trialUsed: church.trial_used,
      pendingPaymentRequests: pendingCount ?? 0,
      totalInvoices: invoiceCount ?? 0,
    },
    error: null,
  };
}

// ============================================================================
// Platform Billing Stats
// ============================================================================

export async function getPlatformBillingStats(
  supabase: SupabaseClient<Database>,
): Promise<ServiceResult<PlatformBillingStats>> {
  const { data: churches, error } = await supabase
    .from("churches")
    .select("subscription_tier, subscription_status, subscription_expires_at")
    .is("deleted_at", null);

  if (error) return { data: null, error: error.message };

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let freeChurches = 0;
  let trialChurches = 0;
  let monthlySubscriptions = 0;
  let yearlySubscriptions = 0;
  let expiringSubscriptions = 0;
  let gracePeriodChurches = 0;

  for (const church of churches ?? []) {
    const tier = church.subscription_tier;
    const status = church.subscription_status;
    const expiresAt = church.subscription_expires_at ? new Date(church.subscription_expires_at) : null;

    if (tier === "free") freeChurches++;
    else if (tier === "trial") trialChurches++;
    else if (tier === "monthly") monthlySubscriptions++;
    else if (tier === "yearly") yearlySubscriptions++;

    if (expiresAt && expiresAt > now && expiresAt <= thirtyDaysFromNow) {
      expiringSubscriptions++;
    }

    if (status === "grace" || (expiresAt && expiresAt <= now && tier !== "free" && tier !== "trial")) {
      gracePeriodChurches++;
    }
  }

  const { count: pendingCount } = await supabase
    .from("payment_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const { data: approvedInvoices } = await supabase
    .from("invoices")
    .select("amount")
    .eq("status", "issued");

  const totalRevenue = (approvedInvoices ?? []).reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

  return {
    data: {
      totalChurches: churches?.length ?? 0,
      freeChurches,
      trialChurches,
      monthlySubscriptions,
      yearlySubscriptions,
      expiringSubscriptions,
      gracePeriodChurches,
      pendingPaymentRequests: pendingCount ?? 0,
      totalRevenue,
    },
    error: null,
  };
}

// ============================================================================
// Invoice Number Generation
// ============================================================================

export async function getNextInvoiceNumber(
  supabase: SupabaseClient<Database>,
): Promise<ServiceResult<string>> {
  const { data, error } = await supabase.rpc("generate_invoice_number");

  if (error) return { data: null, error: error.message };
  return { data: data as string, error: null };
}
