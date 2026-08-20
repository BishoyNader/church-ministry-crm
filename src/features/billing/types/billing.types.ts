import type { Database } from "@/types/database.types";

// ============================================================================
// Subscription Plans
// ============================================================================

export const SUBSCRIPTION_PLANS = ["free", "trial", "monthly", "yearly"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const PAID_PLANS = ["monthly", "yearly"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export const PLAN_PRICES: Record<PaidPlan, { amount: number; currency: string; monthlyEquivalent: number }> = {
  monthly: { amount: 499, currency: "EGP", monthlyEquivalent: 499 },
  yearly: { amount: 3999, currency: "EGP", monthlyEquivalent: 333.25 },
};

export const YEARLY_SAVINGS = {
  annualTotal: 5988,
  yearlyPrice: 3999,
  savedAmount: 1989,
  savedPercent: 33,
};

// ============================================================================
// Entitlements
// ============================================================================

export type Entitlements = {
  maxServices: number;
  maxStages: number;
  maxServants: number;
  maxBeneficiaries: number;
  maxActiveEvents: number;
  canBulkImport: boolean;
  canAdvancedReports: boolean;
  canAdvancedAnalytics: boolean;
  canAiAssistant: boolean;
  canAdvancedExport: boolean;
  canAdvancedCrm: boolean;
  canNotifications: boolean;
  canSpiritualJournal: boolean;
};

// ============================================================================
// Subscription Status
// ============================================================================

export const SUBSCRIPTION_STATUSES = ["active", "expired", "grace", "inactive"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// ============================================================================
// Payment Request
// ============================================================================

export const PAYMENT_REQUEST_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type PaymentRequestStatus = (typeof PAYMENT_REQUEST_STATUSES)[number];

export type PaymentRequestRow = Database["public"]["Tables"]["payment_requests"]["Row"];
export type PaymentRequestInsert = Database["public"]["Tables"]["payment_requests"]["Insert"];
export type PaymentRequestUpdate = Database["public"]["Tables"]["payment_requests"]["Update"];

export type PaymentRequestWithProfiles = PaymentRequestRow & {
  profiles: { full_name_ar: string; full_name_en: string | null; email: string } | null;
  reviewed_by_profile: { full_name_ar: string; full_name_en: string | null } | null;
};

// ============================================================================
// Invoice
// ============================================================================

export const INVOICE_STATUSES = ["issued", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
export type InvoiceInsert = Database["public"]["Tables"]["invoices"]["Insert"];

// ============================================================================
// Refund
// ============================================================================

export const REFUND_STATUSES = ["pending", "approved", "rejected", "completed"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export type RefundRow = Database["public"]["Tables"]["refunds"]["Row"];
export type RefundInsert = Database["public"]["Tables"]["refunds"]["Insert"];

// ============================================================================
// Billing Summary (for church manager view)
// ============================================================================

export type ChurchBillingSummary = {
  churchId: string;
  churchNameAr: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  subscriptionExpiresAt: string | null;
  trialUsed: boolean;
  pendingPaymentRequests: number;
  totalInvoices: number;
};

// ============================================================================
// Platform Billing Stats
// ============================================================================

export type PlatformBillingStats = {
  totalChurches: number;
  freeChurches: number;
  trialChurches: number;
  monthlySubscriptions: number;
  yearlySubscriptions: number;
  expiringSubscriptions: number;
  gracePeriodChurches: number;
  pendingPaymentRequests: number;
  totalRevenue: number;
};

// ============================================================================
// Action Results
// ============================================================================

export type BillingActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};

// ============================================================================
// Page Data Types
// ============================================================================

export type PaymentRequestsPageData = {
  rows: PaymentRequestRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type InvoicesPageData = {
  rows: InvoiceRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type RefundsPageData = {
  rows: RefundRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// ============================================================================
// Billing Config (platform owner configurable values)
// ============================================================================

export const BILLING_CONFIG = {
  instapayAccountName: "PLACEHOLDER_COMPANY_NAME",
  instapayAccountNumber: "PLACEHOLDER_ACCOUNT_NUMBER",
  supportEmail: "support@churchcrm.example.com",
  supportPhone: "+20-PLACEHOLDER",
  supportWhatsApp: "+20-PLACEHOLDER",
  gracePeriodDays: 7,
  dataRetentionDays: 180,
  trialDurationDays: 30,
} as const;
