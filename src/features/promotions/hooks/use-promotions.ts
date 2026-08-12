"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listPromotionRunsAction,
  listPromotionEntriesAction,
  listPromotionEntriesByCycleAction,
  listPromotionTransitionsAction,
  listPromotionCyclesAction,
  confirmPromotionCycleAction,
  runAnnualPromotionsAction,
  runSinglePromotionAction,
  undoPromotionAction,
  undoAllPromotionsAction,
} from "../actions/promotions.actions";
import type { PromotionEntry } from "../types/promotions.types";

export const PROMOTION_QUERY_KEYS = {
  all: ["promotions"] as const,
  runs: ["promotions", "runs"] as const,
  cycles: ["promotions", "cycles"] as const,
  entries: (runId: string) => ["promotions", "entries", runId] as const,
};

export function usePromotionCycles() {
  return useQuery({
    queryKey: PROMOTION_QUERY_KEYS.cycles,
    queryFn: async () => {
      const result = await listPromotionCyclesAction();
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load promotion cycles.");
      }
      return result.data;
    },
    staleTime: 30_000,
  });
}

export function useConfirmPromotionCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cycleId: string) => confirmPromotionCycleAction(cycleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROMOTION_QUERY_KEYS.all });
    },
  });
}

export function usePromotionRuns() {
  return useQuery({
    queryKey: PROMOTION_QUERY_KEYS.runs,
    queryFn: async () => {
      const result = await listPromotionRunsAction();
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load promotion runs.");
      }
      return result.data;
    },
    staleTime: 30_000,
  });
}

export function usePromotionCycleEntries(cycleId: string | null) {
  return useQuery({
    queryKey: ["promotions", "cycle-entries", cycleId ?? ""] as const,
    queryFn: async () => {
      const result = await listPromotionEntriesByCycleAction(cycleId!);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load promotion entries.");
      }
      return result.data as PromotionEntry[];
    },
    enabled: !!cycleId,
    staleTime: 30_000,
  });
}

export function usePromotionTransitions(cycleId: string | null) {
  return useQuery({
    queryKey: ["promotions", "cycle-transitions", cycleId ?? ""] as const,
    queryFn: async () => {
      const result = await listPromotionTransitionsAction(cycleId!);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load promotion transitions.");
      }
      return result.data;
    },
    enabled: !!cycleId,
    staleTime: 30_000,
  });
}

export function usePromotionEntries(runId: string | null) {
  return useQuery({
    queryKey: PROMOTION_QUERY_KEYS.entries(runId ?? ""),
    queryFn: async () => {
      const result = await listPromotionEntriesAction(runId!);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load promotion entries.");
      }
      return result.data as PromotionEntry[];
    },
    enabled: !!runId,
    staleTime: 30_000,
  });
}

export function useRunAnnualPromotions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: {
      stageId: string;
      academicYear: number;
      notes?: string | null;
    }) =>
      runAnnualPromotionsAction(values.stageId, values.academicYear, values.notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROMOTION_QUERY_KEYS.runs });
    },
  });
}

export function useRunSinglePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: {
      beneficiaryId: string;
      targetStageId: string;
      academicYear: number;
      note?: string | null;
    }) =>
      runSinglePromotionAction(
        values.beneficiaryId,
        values.targetStageId,
        values.academicYear,
        values.note,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROMOTION_QUERY_KEYS.all });
    },
  });
}

export function useUndoPromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => undoPromotionAction(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROMOTION_QUERY_KEYS.all });
    },
  });
}

export function useUndoAllPromotions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => undoAllPromotionsAction(runId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROMOTION_QUERY_KEYS.all });
    },
  });
}
