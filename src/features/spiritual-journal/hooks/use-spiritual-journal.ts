"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSpiritualJournalEntriesAction,
  createSpiritualJournalEntryAction,
  updateSpiritualJournalEntryAction,
  deleteSpiritualJournalEntryAction,
  listChurchJournalServantsAction,
  listServantJournalEntriesAction,
} from "../actions/spiritual-journal.actions";
import type {
  CreateSpiritualJournalFormValues,
  UpdateSpiritualJournalFormValues,
} from "../schemas/spiritual-journal.schema";
import type { SpiritualJournalListParams } from "../types/spiritual-journal.types";

export const SPIRITUAL_JOURNAL_QUERY_KEYS = {
  all: ["spiritual-journal"] as const,
  list: (filters?: SpiritualJournalListParams) => ["spiritual-journal", "list", filters] as const,
  churchServants: ["spiritual-journal", "church-servants"] as const,
  servantEntries: (servantId: string, filters?: SpiritualJournalListParams) =>
    ["spiritual-journal", "servant-entries", servantId, filters] as const,
};

export function useSpiritualJournalList(filters?: SpiritualJournalListParams) {
  return useQuery({
    queryKey: SPIRITUAL_JOURNAL_QUERY_KEYS.list(filters),
    queryFn: async () => {
      const result = await listSpiritualJournalEntriesAction(filters);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load journal entries.");
      }
      return result;
    },
    staleTime: 30_000,
  });
}

export function useChurchJournalServants() {
  return useQuery({
    queryKey: SPIRITUAL_JOURNAL_QUERY_KEYS.churchServants,
    queryFn: async () => {
      const result = await listChurchJournalServantsAction();
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load servants.");
      }
      return result;
    },
    staleTime: 60_000,
  });
}

export function useServantJournalEntries(
  servantId: string | null,
  filters?: SpiritualJournalListParams,
) {
  return useQuery({
    queryKey: SPIRITUAL_JOURNAL_QUERY_KEYS.servantEntries(servantId ?? "", filters),
    queryFn: async () => {
      const result = await listServantJournalEntriesAction(servantId!, filters);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load servant journal entries.");
      }
      return result;
    },
    enabled: !!servantId,
    staleTime: 30_000,
  });
}

export function useCreateSpiritualJournalEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CreateSpiritualJournalFormValues) => createSpiritualJournalEntryAction(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SPIRITUAL_JOURNAL_QUERY_KEYS.all }),
  });
}

export function useUpdateSpiritualJournalEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, values }: { entryId: string; values: UpdateSpiritualJournalFormValues }) =>
      updateSpiritualJournalEntryAction(entryId, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SPIRITUAL_JOURNAL_QUERY_KEYS.all }),
  });
}

export function useDeleteSpiritualJournalEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => deleteSpiritualJournalEntryAction(entryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SPIRITUAL_JOURNAL_QUERY_KEYS.all }),
  });
}