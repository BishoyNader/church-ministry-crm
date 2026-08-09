"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  activateChurchAction,
  changeChurchManagerAction,
  createChurchAction,
  deactivateChurchAction,
  deactivateChurchUserAction,
  disableChurchAction,
  getChurchAction,
  getChurchAuditAction,
  getChurchClassesAction,
  getChurchReportsAction,
  getChurchServicesAction,
  getChurchStagesAction,
  getChurchStatsAction,
  getChurchUsersAction,
  getChurchesSummaryAction,
  listChurchesAction,
  reactivateChurchAction,
  resetChurchManagerPasswordAction,
  suspendChurchAction,
  updateChurchAction,
} from "../actions/church-admin.actions";
import { provisionChurchWizardAction } from "../actions/church-provisioning.actions";
import type { ChurchFilters } from "../types/church.types";
import type { ProvisionChurchWizardValues } from "../schemas/provisioning.schema";

export const CHURCHES_QUERY_KEYS = {
  all: ["churches"] as const,
  list: (filters: ChurchFilters) => ["churches", "list", filters] as const,
  summary: ["churches", "summary"] as const,
  detail: (churchId: string) => ["churches", "detail", churchId] as const,
  stats: (churchId: string) => ["churches", "stats", churchId] as const,
  users: (churchId: string, filters: ChurchFilters) =>
    ["churches", "users", churchId, filters] as const,
  services: (churchId: string) => ["churches", "services", churchId] as const,
  stages: (churchId: string) => ["churches", "stages", churchId] as const,
  classes: (churchId: string) => ["churches", "classes", churchId] as const,
  audit: (churchId: string, page: number, pageSize: number) =>
    ["churches", "audit", churchId, page, pageSize] as const,
  reports: (churchId: string) => ["churches", "reports", churchId] as const,
};

export function useChurchList(
  filters: ChurchFilters = {},
  options: { enabled?: boolean } = {},
) {
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
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useChurchesSummary() {
  const locale = useLocale();
  return useQuery({
    queryKey: CHURCHES_QUERY_KEYS.summary,
    queryFn: async () => {
      const result = await getChurchesSummaryAction(locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load church summary.");
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

export function useChurchUsers(churchId: string, filters: ChurchFilters = {}) {
  const locale = useLocale();
  return useQuery({
    queryKey: CHURCHES_QUERY_KEYS.users(churchId, filters),
    queryFn: async () => {
      const result = await getChurchUsersAction(churchId, filters, locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load church users.");
      }
      return result;
    },
    enabled: !!churchId,
    staleTime: 30_000,
  });
}

export function useChurchServices(churchId: string) {
  const locale = useLocale();
  return useQuery({
    queryKey: CHURCHES_QUERY_KEYS.services(churchId),
    queryFn: async () => {
      const result = await getChurchServicesAction(churchId, locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load services.");
      }
      return result;
    },
    enabled: !!churchId,
    staleTime: 30_000,
  });
}

export function useChurchStages(churchId: string) {
  const locale = useLocale();
  return useQuery({
    queryKey: CHURCHES_QUERY_KEYS.stages(churchId),
    queryFn: async () => {
      const result = await getChurchStagesAction(churchId, locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load stages.");
      }
      return result;
    },
    enabled: !!churchId,
    staleTime: 30_000,
  });
}

export function useChurchClasses(churchId: string) {
  const locale = useLocale();
  return useQuery({
    queryKey: CHURCHES_QUERY_KEYS.classes(churchId),
    queryFn: async () => {
      const result = await getChurchClassesAction(churchId, locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load classes.");
      }
      return result;
    },
    enabled: !!churchId,
    staleTime: 30_000,
  });
}

export function useChurchAudit(churchId: string, page = 1, pageSize = 20) {
  const locale = useLocale();
  return useQuery({
    queryKey: CHURCHES_QUERY_KEYS.audit(churchId, page, pageSize),
    queryFn: async () => {
      const result = await getChurchAuditAction(churchId, page, pageSize, locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load audit log.");
      }
      return result;
    },
    enabled: !!churchId,
    staleTime: 30_000,
  });
}

export function useChurchReports(churchId: string) {
  const locale = useLocale();
  return useQuery({
    queryKey: CHURCHES_QUERY_KEYS.reports(churchId),
    queryFn: async () => {
      const result = await getChurchReportsAction(churchId, locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load reports.");
      }
      return result;
    },
    enabled: !!churchId,
    staleTime: 60_000,
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
      queryClient.invalidateQueries({ queryKey: CHURCHES_QUERY_KEYS.summary });
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
      queryClient.invalidateQueries({ queryKey: CHURCHES_QUERY_KEYS.summary });
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
      queryClient.invalidateQueries({ queryKey: CHURCHES_QUERY_KEYS.summary });
    },
  });
}

export function useSuspendChurch() {
  const queryClient = useQueryClient();
  const locale = useLocale();
  return useMutation({
    mutationFn: (churchId: string) => suspendChurchAction(churchId, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHURCHES_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CHURCHES_QUERY_KEYS.summary });
    },
  });
}

export function useDisableChurch() {
  const queryClient = useQueryClient();
  const locale = useLocale();
  return useMutation({
    mutationFn: (churchId: string) => disableChurchAction(churchId, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHURCHES_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CHURCHES_QUERY_KEYS.summary });
    },
  });
}

export function useReactivateChurch() {
  const queryClient = useQueryClient();
  const locale = useLocale();
  return useMutation({
    mutationFn: (churchId: string) => reactivateChurchAction(churchId, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHURCHES_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CHURCHES_QUERY_KEYS.summary });
    },
  });
}

export function useChangeChurchManager() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: ({
      churchId,
      newUserId,
    }: {
      churchId: string;
      newUserId: string;
    }) => changeChurchManagerAction(churchId, newUserId, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHURCHES_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["churches", "audit"] });
    },
  });
}

export function useDeactivateChurchUser() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: ({
      churchId,
      userId,
    }: {
      churchId: string;
      userId: string;
    }) => deactivateChurchUserAction(churchId, userId, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHURCHES_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["churches", "users"] });
    },
  });
}

export function useResetChurchManagerPassword() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: ({
      churchId,
      newPassword,
    }: {
      churchId: string;
      newPassword: string;
    }) => resetChurchManagerPasswordAction(churchId, newPassword, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["churches", "audit"] });
    },
  });
}

export function useProvisionChurchWizard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: ProvisionChurchWizardValues) =>
      provisionChurchWizardAction(values),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: CHURCHES_QUERY_KEYS.all });
        queryClient.invalidateQueries({ queryKey: CHURCHES_QUERY_KEYS.summary });
      }
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
