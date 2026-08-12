import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AnnualPromotionRun,
  PromotionCycle,
  PromotionEntry,
} from "../types/promotions.types";

type ServiceResult<T> = { data: T | null; error: string | null };

type RunRow = {
  id: string;
  church_id: string;
  stage_id: string;
  academic_year: number;
  status: "applied" | "reverted";
  notes: string | null;
  run_by: string;
  created_at: string;
  stage: { name_ar: string | null; name_en: string | null; service: { name_ar: string | null; name_en: string | null } | null } | null;
  promotion_entries: Array<{ id: string; undone_at: string | null }>;
};

type EntryRow = {
  id: string;
  annual_promotion_id: string;
  church_id: string;
  beneficiary_id: string;
  from_stage_id: string;
  to_stage_id: string | null;
  is_graduated: boolean;
  note: string | null;
  undone_at: string | null;
  undone_by: string | null;
  created_at: string;
  beneficiaries: { full_name_ar: string | null; full_name_en: string | null } | null;
  from_stage: { name_ar: string | null; name_en: string | null } | null;
  to_stage: { name_ar: string | null; name_en: string | null } | null;
};

export type PromotionTransition = {
  id: string;
  churchId: string;
  cycleId: string;
  servantId: string;
  servantName: string;
  fromStageName: string | null;
  toStageName: string | null;
  fromServiceName: string | null;
  toServiceName: string | null;
  status: "pending" | "published" | "skipped";
};

type TransitionRow = {
  id: string;
  church_id: string;
  cycle_id: string;
  servant_id: string;
  status: "pending" | "published" | "skipped";
  profiles: { full_name_ar: string | null; full_name_en: string | null } | null;
  from_stage: { name_ar: string | null; name_en: string | null; service: { name_ar: string | null; name_en: string | null } | null } | null;
  to_stage: { name_ar: string | null; name_en: string | null; service: { name_ar: string | null; name_en: string | null } | null } | null;
};

type CycleRow = {
  id: string;
  church_id: string;
  academic_year: number;
  status: "pending_confirmation" | "confirmed";
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_at: string;
  promotion_entries: Array<{
    beneficiary_id: string;
    from_stage_id: string;
    from_stage: { service_id: string } | null;
    undone_at: string | null;
  }>;
  promotion_servant_transitions: Array<{
    servant_id: string;
    status: "pending" | "published" | "skipped";
  }>;
};

/**
 * Lists promotion cycles (the annual confirmation surface) for the church with
 * dashboard counts: active beneficiaries promoted, affected services, affected
 * servants and pending servant transitions.
 */
export async function listPromotionCycles(
  supabase: SupabaseClient,
): Promise<ServiceResult<PromotionCycle[]>> {
  try {
    // NOTE: PostgREST requires explicit FK-constraint-name embeds whenever a
    // table has MORE than one foreign key to the target table. promotion_entries
    // has two FKs to stages (from_stage_id, to_stage_id), so the plain
    // `from_stage(...)` embed fails with "Could not find a relationship" (this
    // surfaced as "فشل تحميل سجل الترقيات" on staging). The FK constraint names
    // below are unambiguous. NOTE: these embeds depend on Postgres's default
    // FK constraint names — if a future migration renames a constraint, update
    // the embeds here (regression probe: repro-churchadmin.mjs).
    const { data, error } = await supabase
      .from("promotion_cycles")
      .select(
        "id, church_id, academic_year, status, confirmed_at, confirmed_by, created_at, " +
          "promotion_entries(beneficiary_id, from_stage_id, promotion_entries_from_stage_id_fkey(service_id), undone_at), " +
          "promotion_servant_transitions(servant_id, status)",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return { data: null, error: error.message };
    }

    const cycles: PromotionCycle[] = ((data ?? []) as unknown as CycleRow[]).map(
      (row) => {
        const entries = row.promotion_entries ?? [];
        const activeEntries = entries.filter((entry) => !entry.undone_at);
        const beneficiariesPromoted = new Set(
          activeEntries.map((entry) => entry.beneficiary_id),
        ).size;
        const affectedServices = new Set(
          activeEntries
            .map((entry) => entry.from_stage?.service_id)
            .filter((id): id is string => !!id),
        ).size;
        const transitions = row.promotion_servant_transitions ?? [];
        const affectedServants = new Set(
          transitions.map((transition) => transition.servant_id),
        ).size;
        const pendingTransitions = transitions.filter(
          (transition) => transition.status === "pending",
        ).length;

        return {
          id: row.id,
          churchId: row.church_id,
          academicYear: row.academic_year,
          status: row.status,
          confirmedAt: row.confirmed_at,
          confirmedBy: row.confirmed_by,
          createdAt: row.created_at,
          beneficiariesPromoted,
          affectedServices,
          affectedServants,
          pendingTransitions,
        };
      },
    );

    return { data: cycles, error: null };
  } catch {
    return { data: null, error: "Failed to load promotion cycles." };
  }
}

export async function listPromotionRuns(
  supabase: SupabaseClient,
): Promise<ServiceResult<AnnualPromotionRun[]>> {
  try {
    // Embed by the referenced table name (`stages`, `services`) — the plain
    // column-derived `stage(...)`/`service(...)` aliases are not resolvable by
    // this PostgREST version and caused "Could not find a relationship".
    const { data, error } = await supabase
      .from("annual_promotions")
      .select(
        "id, church_id, stage_id, academic_year, status, notes, run_by, created_at, " +
          "stages(name_ar, name_en, services(name_ar, name_en)), " +
          "promotion_entries(id, undone_at)",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return { data: null, error: error.message };
    }

    const runs = ((data ?? []) as unknown as RunRow[]).map((row) => ({
      id: row.id,
      churchId: row.church_id,
      stageId: row.stage_id,
      academicYear: row.academic_year,
      status: row.status,
      notes: row.notes,
      runBy: row.run_by,
      createdAt: row.created_at,
      stageName: row.stage?.name_ar ?? row.stage?.name_en ?? null,
      serviceName: row.stage?.service?.name_ar ?? row.stage?.service?.name_en ?? null,
      totalEntries: row.promotion_entries?.length ?? 0,
      undoneEntries: (row.promotion_entries ?? []).filter((entry) => entry.undone_at).length,
    }));

    return { data: runs, error: null };
  } catch {
    return { data: null, error: "Failed to load promotion runs." };
  }
}

export async function listPromotionEntriesByCycle(
  supabase: SupabaseClient,
  cycleId: string,
): Promise<ServiceResult<PromotionEntry[]>> {
  try {
    const { data, error } = await supabase
      .from("promotion_entries")
      .select(
        "id, annual_promotion_id, church_id, beneficiary_id, from_stage_id, to_stage_id, " +
          "is_graduated, note, undone_at, undone_by, created_at, " +
          "beneficiaries(full_name_ar, full_name_en), " +
          "promotion_entries_from_stage_id_fkey(name_ar, name_en), " +
          "promotion_entries_to_stage_id_fkey(name_ar, name_en)",
      )
      .eq("cycle_id", cycleId)
      .order("created_at", { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    const entries = ((data ?? []) as unknown as EntryRow[]).map((row) => ({
      id: row.id,
      annualPromotionId: row.annual_promotion_id,
      churchId: row.church_id,
      beneficiaryId: row.beneficiary_id,
      fromStageId: row.from_stage_id,
      toStageId: row.to_stage_id,
      isGraduated: row.is_graduated,
      note: row.note,
      undoneAt: row.undone_at,
      undoneBy: row.undone_by,
      createdAt: row.created_at,
      beneficiaryName: row.beneficiaries?.full_name_ar ?? row.beneficiaries?.full_name_en ?? "",
      fromStageName: row.from_stage?.name_ar ?? row.from_stage?.name_en ?? null,
      toStageName: row.to_stage?.name_ar ?? row.to_stage?.name_en ?? null,
    }));

    return { data: entries, error: null };
  } catch {
    return { data: null, error: "Failed to load promotion entries." };
  }
}

/**
 * Lists the servant assignment transitions of a cycle for the review screen:
 * who moves from which stage to which stage, and the transition state.
 */
export async function listPromotionTransitions(
  supabase: SupabaseClient,
  cycleId: string,
): Promise<ServiceResult<PromotionTransition[]>> {
  try {
    // Two FKs to profiles (servant_id, published_by) and two to stages make
    // the plain `profiles`/`from_stage`/`to_stage` embeds ambiguous — use the
    // FK constraint names.
    const { data, error } = await supabase
      .from("promotion_servant_transitions")
      .select(
        "id, church_id, cycle_id, servant_id, status, " +
          "promotion_servant_transitions_servant_id_fkey(full_name_ar, full_name_en), " +
          "promotion_servant_transitions_from_stage_id_fkey(name_ar, name_en, services(name_ar, name_en)), " +
          "promotion_servant_transitions_to_stage_id_fkey(name_ar, name_en, services(name_ar, name_en))",
      )
      .eq("cycle_id", cycleId)
      .order("created_at", { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    const transitions = ((data ?? []) as unknown as TransitionRow[]).map((row) => ({
      id: row.id,
      churchId: row.church_id,
      cycleId: row.cycle_id,
      servantId: row.servant_id,
      servantName:
        row.profiles?.full_name_ar ?? row.profiles?.full_name_en ?? "",
      fromStageName: row.from_stage?.name_ar ?? row.from_stage?.name_en ?? null,
      toStageName: row.to_stage?.name_ar ?? row.to_stage?.name_en ?? null,
      fromServiceName:
        row.from_stage?.service?.name_ar ?? row.from_stage?.service?.name_en ?? null,
      toServiceName:
        row.to_stage?.service?.name_ar ?? row.to_stage?.service?.name_en ?? null,
      status: row.status,
    }));

    return { data: transitions, error: null };
  } catch {
    return { data: null, error: "Failed to load promotion transitions." };
  }
}

export async function listPromotionEntries(
  supabase: SupabaseClient,
  runId: string,
): Promise<ServiceResult<PromotionEntry[]>> {
  try {
    const { data, error } = await supabase
      .from("promotion_entries")
      .select(
        "id, annual_promotion_id, church_id, beneficiary_id, from_stage_id, to_stage_id, " +
          "is_graduated, note, undone_at, undone_by, created_at, " +
          "beneficiaries(full_name_ar, full_name_en), " +
          "promotion_entries_from_stage_id_fkey(name_ar, name_en), " +
          "promotion_entries_to_stage_id_fkey(name_ar, name_en)",
      )
      .eq("annual_promotion_id", runId)
      .order("created_at", { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    const entries = ((data ?? []) as unknown as EntryRow[]).map((row) => ({
      id: row.id,
      annualPromotionId: row.annual_promotion_id,
      churchId: row.church_id,
      beneficiaryId: row.beneficiary_id,
      fromStageId: row.from_stage_id,
      toStageId: row.to_stage_id,
      isGraduated: row.is_graduated,
      note: row.note,
      undoneAt: row.undone_at,
      undoneBy: row.undone_by,
      createdAt: row.created_at,
      beneficiaryName: row.beneficiaries?.full_name_ar ?? row.beneficiaries?.full_name_en ?? "",
      fromStageName: row.from_stage?.name_ar ?? row.from_stage?.name_en ?? null,
      toStageName: row.to_stage?.name_ar ?? row.to_stage?.name_en ?? null,
    }));

    return { data: entries, error: null };
  } catch {
    return { data: null, error: "Failed to load promotion entries." };
  }
}
