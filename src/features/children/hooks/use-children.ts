"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listChildrenAction,
  getChildByIdAction,
  createChildAction,
  updateChildAction,
  transferChildAction,
  deactivateChildAction,
  listStagesAction,
  listMinistriesAction,
} from "../actions/child.actions";
import type {
  CreateChildFormValues,
  UpdateChildFormValues,
  TransferChildFormValues,
} from "../schemas/child.schema";
import type { PaginationInput } from "../types/child.types";

export const CHILD_QUERY_KEYS = {
  all: ["children"] as const,
  list: (
    filters?: {
      search?: string;
      ministry_id?: string;
      stage_id?: string;
      status?: string;
      pipeline_stage?: string;
    },
    pagination?: PaginationInput,
  ) => ["children", "list", filters, pagination] as const,
  detail: (id: string) => ["children", "detail", id] as const,
  stages: (ministryId?: string) => ["children", "stages", ministryId] as const,
  ministries: () => ["children", "ministries"] as const,
};

export function useChildList(
  filters?: {
    search?: string;
    ministry_id?: string;
    stage_id?: string;
    status?: string;
    pipeline_stage?: string;
  },
  pagination?: PaginationInput,
) {
  return useQuery({
    queryKey: CHILD_QUERY_KEYS.list(filters, pagination),
    queryFn: () => listChildrenAction(filters, pagination),
    staleTime: 30_000,
  });
}

export function useChildDetail(childId: string | null) {
  return useQuery({
    queryKey: CHILD_QUERY_KEYS.detail(childId ?? ""),
    queryFn: () => getChildByIdAction(childId!),
    enabled: !!childId,
    staleTime: 30_000,
  });
}

export function useCreateChild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CreateChildFormValues) => createChildAction(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHILD_QUERY_KEYS.all });
    },
  });
}

export function useUpdateChild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      childId,
      values,
    }: {
      childId: string;
      values: UpdateChildFormValues;
    }) => updateChildAction(childId, values),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: CHILD_QUERY_KEYS.all });
      queryClient.invalidateQueries({
        queryKey: CHILD_QUERY_KEYS.detail(variables.childId),
      });
    },
  });
}

export function useTransferChild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      childId,
      values,
    }: {
      childId: string;
      values: TransferChildFormValues;
    }) => transferChildAction(childId, values),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: CHILD_QUERY_KEYS.all });
      queryClient.invalidateQueries({
        queryKey: CHILD_QUERY_KEYS.detail(variables.childId),
      });
    },
  });
}

export function useDeactivateChild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (childId: string) => deactivateChildAction(childId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHILD_QUERY_KEYS.all });
    },
  });
}

export function useChildStages(ministryId?: string) {
  return useQuery({
    queryKey: CHILD_QUERY_KEYS.stages(ministryId),
    queryFn: () => listStagesAction(ministryId),
    staleTime: 60_000,
  });
}

export function useChildMinistries() {
  return useQuery({
    queryKey: CHILD_QUERY_KEYS.ministries(),
    queryFn: () => listMinistriesAction(),
    staleTime: 60_000,
  });
}
