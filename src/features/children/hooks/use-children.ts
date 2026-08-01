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
  listServicesAction,
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
      service_id?: string;
      stage_id?: string;
      status?: string;
    },
    pagination?: PaginationInput,
  ) => ["children", "list", filters, pagination] as const,
  detail: (id: string) => ["children", "detail", id] as const,
  stages: (serviceId?: string) => ["children", "stages", serviceId] as const,
  services: () => ["children", "services"] as const,
};

export function useChildList(
  filters?: {
    search?: string;
    service_id?: string;
    stage_id?: string;
    status?: string;
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
    onSuccess: (_data, childId) => {
      queryClient.invalidateQueries({ queryKey: CHILD_QUERY_KEYS.all });
      queryClient.invalidateQueries({
        queryKey: CHILD_QUERY_KEYS.detail(childId),
      });
    },
  });
}

export function useChildStages(serviceId?: string) {
  return useQuery({
    queryKey: CHILD_QUERY_KEYS.stages(serviceId),
    queryFn: () => listStagesAction(serviceId),
    staleTime: 60_000,
  });
}

export function useChildServices() {
  return useQuery({
    queryKey: CHILD_QUERY_KEYS.services(),
    queryFn: () => listServicesAction(),
    staleTime: 60_000,
  });
}
