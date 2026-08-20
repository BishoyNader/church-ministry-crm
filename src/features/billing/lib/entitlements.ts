import type { SubscriptionPlan, Entitlements } from "../types/billing.types";

const UNLIMITED = Number.MAX_SAFE_INTEGER;

const FREE_ENTITLEMENTS: Entitlements = {
  maxServices: 1,
  maxStages: 2,
  maxServants: 10,
  maxBeneficiaries: 30,
  maxActiveEvents: 3,
  canBulkImport: false,
  canAdvancedReports: false,
  canAdvancedAnalytics: false,
  canAiAssistant: false,
  canAdvancedExport: false,
  canAdvancedCrm: false,
  canNotifications: false,
  canSpiritualJournal: false,
};

const FULL_ENTITLEMENTS: Entitlements = {
  maxServices: UNLIMITED,
  maxStages: UNLIMITED,
  maxServants: UNLIMITED,
  maxBeneficiaries: UNLIMITED,
  maxActiveEvents: UNLIMITED,
  canBulkImport: true,
  canAdvancedReports: true,
  canAdvancedAnalytics: true,
  canAiAssistant: true,
  canAdvancedExport: true,
  canAdvancedCrm: true,
  canNotifications: true,
  canSpiritualJournal: true,
};

const PLAN_ENTITLEMENTS: Record<SubscriptionPlan, Entitlements> = {
  free: FREE_ENTITLEMENTS,
  trial: FULL_ENTITLEMENTS,
  monthly: FULL_ENTITLEMENTS,
  yearly: FULL_ENTITLEMENTS,
};

/**
 * Returns entitlements for a given subscription plan.
 */
export function getEntitlements(plan: SubscriptionPlan): Entitlements {
  return PLAN_ENTITLEMENTS[plan];
}

/**
 * Returns true when a specific boolean entitlement is enabled.
 */
export function isFeatureEnabled(entitlements: Entitlements, feature: keyof Entitlements): boolean {
  const value = entitlements[feature];
  return typeof value === "boolean" && value;
}

/**
 * Returns true when the current count is within the plan's limit.
 * Unlimited limits always return true.
 */
export function isWithinLimit(
  entitlements: Entitlements,
  limitKey: "maxServices" | "maxStages" | "maxServants" | "maxBeneficiaries" | "maxActiveEvents",
  currentCount: number,
): boolean {
  return currentCount < entitlements[limitKey];
}

/**
 * Returns the effective plan for a church, resolving trial expiration and
 * grace period.
 *
 * If the church is on 'trial' and the trial has expired, returns 'free'.
 * If the church is on a paid plan and subscription_expires_at is past:
 *   - If subscription_status is 'grace', the paid plan is preserved (the
 *     church retains entitlements during the 7-day grace window).
 *   - Otherwise, returns 'free'.
 */
export function getEffectivePlan(
  tier: string | null,
  trialEndsAt: string | null,
  subscriptionExpiresAt: string | null,
  now: Date = new Date(),
  subscriptionStatus?: string | null,
): SubscriptionPlan {
  if (!tier) return "free";

  const plan = tier as SubscriptionPlan;

  if (plan === "trial") {
    if (trialEndsAt && new Date(trialEndsAt) > now) {
      return "trial";
    }
    return "free";
  }

  if (plan === "monthly" || plan === "yearly") {
    if (subscriptionExpiresAt && new Date(subscriptionExpiresAt) > now) {
      return plan;
    }
    // Grace period: subscription expired but status is 'grace' — retain plan
    if (subscriptionStatus === "grace") {
      return plan;
    }
    return "free";
  }

  return "free";
}

/**
 * Returns remaining days for trial or active subscription.
 * Returns null if not applicable.
 */
export function getRemainingDays(
  plan: SubscriptionPlan,
  trialEndsAt: string | null,
  subscriptionExpiresAt: string | null,
  now: Date = new Date(),
): number | null {
  if (plan === "trial" && trialEndsAt) {
    const diff = new Date(trialEndsAt).getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  if ((plan === "monthly" || plan === "yearly") && subscriptionExpiresAt) {
    const diff = new Date(subscriptionExpiresAt).getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return null;
}
