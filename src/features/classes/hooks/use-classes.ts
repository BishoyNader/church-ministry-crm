"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  archiveClassAction,
  createClassAction,
  listClassesAction,
  listStageOptionsAction,
  restoreClassAction,
  updateClassAction,
} from "../actions/classes.actions";
import type {
  CreateClassFormValues,
  UpdateClassFormValues,
} from "../schemas/classes.schema";
import type { ClassFilters } from "../types/classes.types";

export const CLASSES_QUERY_KEYS = {
  all: ["classes"] as const,
  list: (filters: ClassFilters) => ["classes", "list", filters] as const,
  stageOptions: ["classes", "stageOptions"] as const,
};

export function useClassList(filters: ClassFilters = {}) {
  const locale = useLocale();
  return useQuery({
    queryKey: CLASSES_QUERY_KEYS.list(filters),
    queryFn: async () => {
      const result = await listClassesAction(filters, locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load classes.");
      }
      return result;
    },
    staleTime: 30_000,
  });
}

export function useStageOptions() {
  const locale = useLocale();
  return useQuery({
    queryKey: CLASSES_QUERY_KEYS.stageOptions,
    queryFn: async () => {
      const result = await listStageOptionsAction(locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load stage options.");
      }
      return result;
    },
    staleTime: 60_000,
  });
}

export function useCreateClass() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: (values: CreateClassFormValues) => createClassAction(values, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLASSES_QUERY_KEYS.all });
    },
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: ({
      classId,
      values,
    }: {
      classId: string;
      values: UpdateClassFormValues;
    }) => updateClassAction(classId, values, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLASSES_QUERY_KEYS.all });
    },
  });
}

export function useArchiveClass() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: (classId: string) => archiveClassAction(classId, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLASSES_QUERY_KEYS.all });
    },
  });
}

export function useRestoreClass() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: (classId: string) => restoreClassAction(classId, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLASSES_QUERY_KEYS.all });
    },
  });
}
