import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegistrationFunctions } from "@/types/registration";

// ============================================================================
// Server-side stage scope resolution (D1).
//
// Stage Manager sprint: server actions and services must never trust
// client-supplied stage/church ids. This util is the single resolution point
// for "which stages can this actor read/write?" backed by the
// get_stage_manager_stage_ids() RPC (migration 039), which returns:
//   - super_admin / admin -> every active stage in the actor's church, or
//   - stage_manager / servant -> their active servant_stage_assignments.
//
// churchWide is derived from the actor's active roles so callers can skip the
// stage filter entirely (and guard edge cases such as an admin church with no
// stages yet, where the RPC list alone would wrongly deny access).
// ============================================================================

export type ActorStageScope = {
  churchId: string;
  churchWide: boolean;
  stageIds: string[];
};

export type StageScopeResult = {
  scope: ActorStageScope | null;
  error: string | null;
};

const ADMIN_ROLE_TYPES = new Set(["super_admin", "admin"]);

export async function getActorStageScope(
  supabase: SupabaseClient,
  churchId: string,
  userId: string,
): Promise<StageScopeResult> {
  const { data, error } = await supabase.rpc<
    "get_stage_manager_stage_ids",
    RegistrationFunctions["get_stage_manager_stage_ids"]["Args"]
  >("get_stage_manager_stage_ids");

  if (error) {
    return { scope: null, error: error.message };
  }

  const churchWide = await isChurchWideActor(supabase, userId, churchId);
  const stageIds = new Set<string>((data as string[] | null) ?? []);

  // Annual promotion continuity (049): while a promotion cycle is pending
  // confirmation, a caretaker servant keeps seeing the beneficiaries they
  // carried over to the new stage (the beneficiary placement has already
  // moved; the servant's PUBLISHED assignment only changes on confirmation).
  // The target stages of the servant's pending transitions are merged into
  // the stage scope so the promoted cohort stays visible in the meantime.
  if (!churchWide && userId) {
    try {
      const { data: transitions } = await supabase
        .from("promotion_servant_transitions")
        .select("to_stage_id")
        .eq("servant_id", userId)
        .eq("status", "pending");
      for (const transition of transitions ?? []) {
        const stageId = (transition as { to_stage_id?: string | null }).to_stage_id;
        if (stageId) stageIds.add(stageId);
      }
    } catch {
      // Scope expansion is best-effort; the base scope still applies.
    }
  }

  return {
    scope: {
      churchId,
      stageIds: [...stageIds],
      churchWide,
    },
    error: null,
  };
}

export function isStageInScope(
  scope: ActorStageScope,
  stageId: string | null | undefined,
): boolean {
  if (!stageId) {
    return false;
  }
  if (scope.churchWide) {
    return true;
  }
  return scope.stageIds.includes(stageId);
}

export function filterStageIdsInScope(
  scope: ActorStageScope,
  ids: readonly string[],
): string[] {
  if (scope.churchWide) {
    return [...ids];
  }
  const allowed = new Set(scope.stageIds);
  return ids.filter((id) => allowed.has(id));
}

export function allStagesInScope(
  scope: ActorStageScope,
  ids: readonly string[],
): boolean {
  if (scope.churchWide) {
    return true;
  }
  const allowed = new Set(scope.stageIds);
  return ids.every((id) => allowed.has(id));
}

async function isChurchWideActor(
  supabase: SupabaseClient,
  userId: string,
  churchId: string,
): Promise<boolean> {
  const { data: grants } = await supabase
    .from("user_roles")
    .select("roles(role_type)")
    .eq("user_id", userId)
    .eq("church_id", churchId)
    .is("end_date", null);

  return (grants ?? []).some((grant) => {
    const roleType = (grant as { roles?: { role_type?: string } | null })?.roles?.role_type;
    return roleType !== null && roleType !== undefined && ADMIN_ROLE_TYPES.has(roleType);
  });
}
