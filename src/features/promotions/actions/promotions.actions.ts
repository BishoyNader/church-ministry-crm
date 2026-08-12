"use server";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AnnualPromotionRun,
  PromotionCycle,
  PromotionEntry,
} from "../types/promotions.types";
import * as promotionsService from "../services/promotions.service";

export type PromotionActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};

/**
 * Church admin gate — annual promotions are a super_admin / admin operation
 * only. The RPCs re-validate server-side (user_is_admin) regardless, this is a
 * fast fail before any work is done.
 */
async function isChurchAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();
  if (!profile) return false;

  const { data: isAdmin } = await supabase.rpc("user_is_admin", {
    p_church_id: profile.church_id,
  });
  return isAdmin === true;
}

export async function listPromotionCyclesAction(): Promise<
  PromotionActionResult<PromotionCycle[]>
> {
  const supabase = await createClient();
  if (!(await isChurchAdmin(supabase))) {
    return { success: false, message: "Only a church admin can view promotion cycles." };
  }
  const result = await promotionsService.listPromotionCycles(supabase);
  if (result.error) return { success: false, message: result.error };
  return { success: true, data: result.data ?? undefined };
}

export async function confirmPromotionCycleAction(
  cycleId: string,
): Promise<PromotionActionResult> {
  const supabase = await createClient();
  if (!(await isChurchAdmin(supabase))) {
    return {
      success: false,
      message: "Only a church admin can confirm promotion cycles.",
    };
  }

  const { data, error } = await runRpc<null>(supabase, "confirm_promotion_cycle", {
    p_cycle_id: cycleId,
  });

  if (error) return { success: false, message: error.message };
  return {
    success: true,
    message: "Promotion confirmed and servant assignments published.",
    data: data ?? undefined,
  };
}

export async function listPromotionRunsAction(): Promise<
  PromotionActionResult<AnnualPromotionRun[]>
> {
  const supabase = await createClient();
  if (!(await isChurchAdmin(supabase))) {
    return { success: false, message: "Only a church admin can view promotion runs." };
  }
  const result = await promotionsService.listPromotionRuns(supabase);
  if (result.error) return { success: false, message: result.error };
  return { success: true, data: result.data ?? undefined };
}

export async function listPromotionEntriesByCycleAction(
  cycleId: string,
): Promise<PromotionActionResult<PromotionEntry[]>> {
  const supabase = await createClient();
  if (!(await isChurchAdmin(supabase))) {
    return { success: false, message: "Only a church admin can view promotion entries." };
  }
  const result = await promotionsService.listPromotionEntriesByCycle(supabase, cycleId);
  if (result.error) return { success: false, message: result.error };
  return { success: true, data: result.data ?? undefined };
}

export async function listPromotionTransitionsAction(
  cycleId: string,
): Promise<PromotionActionResult<import("../services/promotions.service").PromotionTransition[]>> {
  const supabase = await createClient();
  if (!(await isChurchAdmin(supabase))) {
    return { success: false, message: "Only a church admin can view promotion transitions." };
  }
  const result = await promotionsService.listPromotionTransitions(supabase, cycleId);
  if (result.error) return { success: false, message: result.error };
  return { success: true, data: result.data ?? undefined };
}

export async function listPromotionEntriesAction(
  runId: string,
): Promise<PromotionActionResult<PromotionEntry[]>> {
  const supabase = await createClient();
  if (!(await isChurchAdmin(supabase))) {
    return { success: false, message: "Only a church admin can view promotion entries." };
  }
  const result = await promotionsService.listPromotionEntries(supabase, runId);
  if (result.error) return { success: false, message: result.error };
  return { success: true, data: result.data ?? undefined };
}

function runRpc<T>(
  supabase: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<{ data: T; error: { message: string } | null }> {
  return (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{
    data: T;
    error: { message: string } | null;
  }>)(name, args);
}

export async function runAnnualPromotionsAction(
  stageId: string,
  academicYear: number,
  notes?: string | null,
): Promise<PromotionActionResult<{ runId: string | null }>> {
  const supabase = await createClient();
  if (!(await isChurchAdmin(supabase))) {
    return { success: false, message: "Only a church admin can run promotions." };
  }

  const { data, error } = await runRpc<string | null>(supabase, "run_annual_promotions", {
    p_stage_id: stageId,
    p_academic_year: academicYear,
    p_notes: notes?.trim() || null,
  });

  if (error) return { success: false, message: error.message };
  return {
    success: true,
    data: { runId: data },
    message: data
      ? "Annual promotion executed."
      : "A promotion for this stage and year already exists.",
  };
}

export async function runSinglePromotionAction(
  beneficiaryId: string,
  targetStageId: string,
  academicYear: number,
  note?: string | null,
): Promise<PromotionActionResult<{ entryId: string | null }>> {
  const supabase = await createClient();
  if (!(await isChurchAdmin(supabase))) {
    return { success: false, message: "Only a church admin can promote beneficiaries." };
  }

  const { data, error } = await runRpc<string | null>(supabase, "run_single_promotion", {
    p_beneficiary_id: beneficiaryId,
    p_target_stage_id: targetStageId,
    p_academic_year: academicYear,
    p_note: note?.trim() || null,
  });

  if (error) return { success: false, message: error.message };
  return { success: true, data: { entryId: data }, message: "Beneficiary promoted." };
}

export async function undoPromotionAction(
  entryId: string,
): Promise<PromotionActionResult> {
  const supabase = await createClient();
  if (!(await isChurchAdmin(supabase))) {
    return { success: false, message: "Only a church admin can undo promotions." };
  }

  const { error } = await runRpc<null>(supabase, "undo_promotion", { p_entry_id: entryId });
  if (error) return { success: false, message: error.message };
  return { success: true, message: "Promotion undone." };
}

export async function undoAllPromotionsAction(
  runId: string,
): Promise<PromotionActionResult> {
  const supabase = await createClient();
  if (!(await isChurchAdmin(supabase))) {
    return { success: false, message: "Only a church admin can undo promotion runs." };
  }

  const { error } = await runRpc<null>(supabase, "undo_all_promotions", { p_run_id: runId });
  if (error) return { success: false, message: error.message };
  return { success: true, message: "Promotion run undone." };
}
