"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  activateChurchAction,
  createChurchAction,
  deactivateChurchAction,
  getChurchAction,
  getChurchStatsAction,
  listChurchesAction,
  updateChurchAction,
} from "../actions/church-admin.actions";
import type { ChurchFilters } from "../types/church.types";

export const CHURCHES_QUERY_KEYS = {
  all: ["churches"] as const,
  list: (filters: ChurchFilters) => ["churches", "list", filters] as const,
  detail: (churchId: string) => ["churches", "detail", churchId] as const,
  stats: (churchId: string) => ["churches", "stats", churchId] as const,
};

export function useChurchList(filters: ChurchFilters = {}) {
  const locale = useLocale();
  return useQuery({
    queryKey: CHURCHES_QUERY_KEYS.list(filters),
    queryFn: async () => {
      const result = await listChurchesAction(filters, locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load churches.");
      }
      return result;
    },
    staleTime: 30_000,
  });
}

export function useChurchDetail(churchId: string) {
  const locale = useLocale();
  return useQuery({
    queryKey: CHURCHES_QUERY_KEYS.detail(churchId),
    queryFn: async () => {
      const result = await getChurchAction(churchId, locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load church.");
      }
      return result;
    },
    enabled: !!churchId,
    staleTime: 30_000,
  });
}

export function useChurchStats(churchId: string) {
  const locale = useLocale();
  return useQuery({
    queryKey: CHURCHES_QUERY_KEYS.stats(churchId),
    queryFn: async () => {
      const result = await getChurchStatsAction(churchId, locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load church stats.");
      }
      return result;
    },
    enabled: !!churchId,
    staleTime: 30_000,
  });
}

export function useCreateChurch() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: (values: Parameters<typeof createChurchAction>[0]) =>
      createChurchAction(values, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHURCHES_QUERY_KEYS.all });
    },
  });
}

export function useUpdateChurch() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: ({
      churchId,
      values,
    }: {
      churchId: string;
      values: Parameters<typeof updateChurchAction>[1];
    }) => updateChurchAction(churchId, values, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHURCHES_QUERY_KEYS.all });
    },
  });
}

export function useActivateChurch() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: (churchId: string) => activateChurchAction(churchId, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHURCHES_QUERY_KEYS.all });
    },
  });
}

export function useDeactivateChurch() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: (churchId: string) => deactivateChurchAction(churchId, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHURCHES_QUERY_KEYS.all });
    },
  });
}

export function useChurchesForSignup() {
  const locale = useLocale();

  return useQuery({
    queryKey: ["churches", "signup"],
    queryFn: async () => {
      const result = await listChurchesAction({ status: "active" }, locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load churches.");
      }
      return result;
    },
    staleTime: 60_000,
  });
}
