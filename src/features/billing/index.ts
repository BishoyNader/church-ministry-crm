export type {
  SubscriptionPlan,
  PaidPlan,
  Entitlements,
  PaymentRequestRow,
  PaymentRequestInsert,
  PaymentRequestStatus,
  InvoiceRow,
  InvoiceInsert,
  InvoiceStatus,
  RefundRow,
  RefundInsert,
  RefundStatus,
  ChurchBillingSummary,
  PlatformBillingStats,
  BillingActionResult,
  PaymentRequestsPageData,
  InvoicesPageData,
  RefundsPageData,
} from "./types/billing.types";

export {
  SUBSCRIPTION_PLANS,
  PAID_PLANS,
  PLAN_PRICES,
  YEARLY_SAVINGS,
  PAYMENT_REQUEST_STATUSES,
  INVOICE_STATUSES,
  REFUND_STATUSES,
  BILLING_CONFIG,
} from "./types/billing.types";

export {
  getEntitlements,
  isFeatureEnabled,
  isWithinLimit,
  getEffectivePlan,
  getRemainingDays,
} from "./lib/entitlements";

export {
  checkEntitlementLimit,
  checkFeatureEntitlement,
} from "./lib/entitlement-guard";

export type {
  EntitlementLimitKey,
  EntitlementCheckResult,
  FeatureCheckResult,
} from "./lib/entitlement-guard";

export {
  useBillingSummary,
  BILLING_QUERY_KEYS,
} from "./hooks/use-billing";

export { BillingPage } from "./components/billing-page";
export { PlatformBillingPage } from "./components/platform-billing-page";
export { SubscriptionCard } from "./components/subscription-card";
export { PricingCard } from "./components/pricing-card";
export { PlanBadge } from "./components/plan-badge";
export { FeatureLock } from "./components/feature-lock";
export { TrialCountdown } from "./components/trial-countdown";
