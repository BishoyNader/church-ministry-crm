"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  archiveServiceAction,
  createServiceAction,
  createServiceWithStagesAction,
  listServicesAction,
  restoreServiceAction,
  updateServiceAction,
} from "../actions/services.actions";
import type {
  CreateServiceFormValues,
  CreateServiceWithStagesFormValues,
  UpdateServiceFormValues,
} from "../schemas/services.schema";
import type { ServiceFilters } from "../types/services.types";

export const SERVICES_QUERY_KEYS = {
  all: ["services"] as const,
  list: (filters: ServiceFilters) => ["services", "list", filters] as const,
};

export function useServiceList(filters: ServiceFilters = {}) {
  const locale = useLocale();
  return useQuery({
    queryKey: SERVICES_QUERY_KEYS.list(filters),
    queryFn: async () => {
      const result = await listServicesAction(filters, locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load services.");
      }
      return result;
    },
    staleTime: 30_000,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: (values: CreateServiceFormValues) => createServiceAction(values, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEYS.all });
    },
  });
}

export function useCreateServiceWithStages() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: (values: CreateServiceWithStagesFormValues) =>
      createServiceWithStagesAction(values, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEYS.all });
    },
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: ({
      serviceId,
      values,
    }: {
      serviceId: string;
      values: UpdateServiceFormValues;
    }) => updateServiceAction(serviceId, values, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEYS.all });
    },
  });
}

export function useArchiveService() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: (serviceId: string) => archiveServiceAction(serviceId, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEYS.all });
    },
  });
}

export function useRestoreService() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: (serviceId: string) => restoreServiceAction(serviceId, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEYS.all });
    },
  });
}
