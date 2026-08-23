import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  getEffectivePlan,
  getEntitlements,
  isWithinLimit,
  isFeatureEnabled,
  PLATFORM_OWNER_ENTITLEMENTS,
  PLATFORM_OWNER_PLAN,
} from "./entitlements";
import type { Entitlements } from "../types/billing.types";

// ============================================================================
// Types
// ============================================================================

export type EntitlementLimitKey =
  | "maxServices"
  | "maxStages"
  | "maxServants"
  | "maxBeneficiaries"
  | "maxActiveEvents";

export type EntitlementCheckResult =
  | { allowed: true; currentCount: number; limit: number; plan: string; entitlements: Entitlements }
  | { allowed: false; currentCount: number; limit: number; plan: string; entitlements: Entitlements; reason: string };

export type FeatureCheckResult =
  | { allowed: true; plan: string; entitlements: Entitlements }
  | { allowed: false; plan: string; entitlements: Entitlements; reason: string };

// ============================================================================
// Count Queries
// ============================================================================

async function countActiveServices(
  supabase: SupabaseClient<Database>,
  churchId: string,
): Promise<number> {
  const { count } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("church_id", churchId)
    .is("deleted_at", null);
  return count ?? 0;
}

async function countActiveStages(
  supabase: SupabaseClient<Database>,
  churchId: string,
): Promise<number> {
  const { count } = await supabase
    .from("stages")
    .select("id", { count: "exact", head: true })
    .eq("church_id", churchId)
    .is("deleted_at", null);
  return count ?? 0;
}

async function countActiveServants(
  supabase: SupabaseClient<Database>,
  churchId: string,
): Promise<number> {
  const { count } = await supabase
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("church_id", churchId)
    .is("end_date", null)
    .neq("role_id", "");
  return count ?? 0;
}

async function countActiveBeneficiaries(
  supabase: SupabaseClient<Database>,
  churchId: string,
): Promise<number> {
  const { count } = await supabase
    .from("beneficiary_assignments")
    .select("id", { count: "exact", head: true })
    .eq("church_id", churchId)
    .is("end_date", null);
  return count ?? 0;
}

async function countActiveEvents(
  supabase: SupabaseClient<Database>,
  churchId: string,
): Promise<number> {
  const now = new Date().toISOString();
  const { count } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("church_id", churchId)
    .eq("is_active", true)
    .gte("end_at", now)
    .is("deleted_at", null);
  return count ?? 0;
}

const COUNT_QUERIES: Record<
  EntitlementLimitKey,
  (supabase: SupabaseClient<Database>, churchId: string) => Promise<number>
> = {
  maxServices: countActiveServices,
  maxStages: countActiveStages,
  maxServants: countActiveServants,
  maxBeneficiaries: countActiveBeneficiaries,
  maxActiveEvents: countActiveEvents,
};

// ============================================================================
// Core Guard Functions
// ============================================================================

/**
 * Resolves the effective plan for a church by querying its subscription fields.
 */
async function resolveChurchPlan(
  supabase: SupabaseClient<Database>,
  churchId: string,
): Promise<{ plan: string; entitlements: Entitlements } | { error: string }> {
  const { data: church, error } = await supabase
    .from("churches")
    .select("subscription_tier, trial_ends_at, subscription_expires_at, subscription_status")
    .eq("id", churchId)
    .single();

  if (error || !church) {
    return { error: "Church not found." };
  }

  const plan = getEffectivePlan(
    church.subscription_tier,
    church.trial_ends_at,
    church.subscription_expires_at,
    new Date(),
    church.subscription_status,
  );

  return { plan, entitlements: getEntitlements(plan) };
}

/**
 * The Platform Owner (a church-less user) sits OUTSIDE the church
 * subscription model: no church subscription is resolved for them and they
 * must never be evaluated against a church plan's limits (e.g. the Free-plan
 * caps). When the acting user has no church context and is the platform
 * owner, entitlement checks pass unrestricted instead of resolving a plan.
 *
 * Returns null when the caller is NOT an exempt platform owner.
 */
async function resolvePlatformOwnerBypass(
  supabase: SupabaseClient<Database>,
  churchId: string | null | undefined,
): Promise<{ plan: string; entitlements: Entitlements } | null> {
  if (churchId) return null;

  // `user_is_platform_owner` exists in the database but is missing from the
  // generated Database["Functions"] types, so cast to a minimal signature.
  const rpc = supabase.rpc as unknown as (
    fn: "user_is_platform_owner",
  ) => Promise<{ data: boolean | null }>;
  const { data: isOwner } = await rpc("user_is_platform_owner");
  if (!isOwner) return null;

  return { plan: PLATFORM_OWNER_PLAN, entitlements: PLATFORM_OWNER_ENTITLEMENTS };
}

/**
 * Server-side entitlement guard: checks whether a church is within its plan's
 * resource limit before allowing a create action.
 *
 * Returns the current count, limit, and plan so the caller can display a
 * meaningful error message.
 */
export async function checkEntitlementLimit(
  supabase: SupabaseClient<Database>,
  churchId: string,
  limitKey: EntitlementLimitKey,
): Promise<EntitlementCheckResult> {
  const ownerBypass = await resolvePlatformOwnerBypass(supabase, churchId);
  if (ownerBypass) {
    return {
      allowed: true,
      currentCount: 0,
      limit: Number.MAX_SAFE_INTEGER,
      plan: ownerBypass.plan,
      entitlements: ownerBypass.entitlements,
    };
  }

  const resolved = await resolveChurchPlan(supabase, churchId);
  if ("error" in resolved) {
    return {
      allowed: false,
      currentCount: 0,
      limit: 0,
      plan: "free",
      entitlements: getEntitlements("free"),
      reason: resolved.error,
    };
  }

  const { plan, entitlements } = resolved;
  const limit = entitlements[limitKey];

  // Unlimited plans always pass
  if (limit >= Number.MAX_SAFE_INTEGER) {
    return { allowed: true, currentCount: 0, limit, plan, entitlements };
  }

  const countFn = COUNT_QUERIES[limitKey];
  const currentCount = await countFn(supabase, churchId);

  if (!isWithinLimit(entitlements, limitKey, currentCount)) {
    return {
      allowed: false,
      currentCount,
      limit,
      plan,
      entitlements,
      reason: `You have reached the maximum ${limitKey.replace("max", "").toLowerCase()} limit (${currentCount}/${limit}) for the ${plan} plan. Please upgrade to create more.`,
    };
  }

  return { allowed: true, currentCount, limit, plan, entitlements };
}

/**
 * Server-side entitlement guard for boolean feature checks (e.g. canSpiritualJournal).
 * Returns whether the feature is enabled on the church's current plan.
 */
export async function checkFeatureEntitlement(
  supabase: SupabaseClient<Database>,
  churchId: string,
  feature: keyof Entitlements,
): Promise<FeatureCheckResult> {
  const ownerBypass = await resolvePlatformOwnerBypass(supabase, churchId);
  if (ownerBypass) {
    return { allowed: true, plan: ownerBypass.plan, entitlements: ownerBypass.entitlements };
  }

  const resolved = await resolveChurchPlan(supabase, churchId);
  if ("error" in resolved) {
    return {
      allowed: false,
      plan: "free",
      entitlements: getEntitlements("free"),
      reason: resolved.error,
    };
  }

  const { plan, entitlements } = resolved;

  if (!isFeatureEnabled(entitlements, feature)) {
    return {
      allowed: false,
      plan,
      entitlements,
      reason: `The ${feature.replace("can", "").toLowerCase()} feature is not available on the ${plan} plan. Please upgrade to access this feature.`,
    };
  }

  return { allowed: true, plan, entitlements };
}
