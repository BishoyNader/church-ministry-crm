"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listMinistriesAction,
  getMinistryByIdAction,
  createMinistryAction,
  updateMinistryAction,
  deactivateMinistryAction,
} from "../actions/stage.actions";
import type {
  CreateMinistryFormValues,
  UpdateMinistryFormValues,
} from "../schemas/stage.schema";

export const MINISTRY_QUERY_KEYS = {
  all: ["ministries"] as const,
  list: () => ["ministries", "list"] as const,
  detail: (id: string) => ["ministries", "detail", id] as const,
};

export function useMinistryList() {
  return useQuery({
    queryKey: MINISTRY_QUERY_KEYS.list(),
    queryFn: () => listMinistriesAction(),
    staleTime: 30_000,
  });
}

export function useMinistryDetail(ministryId: string | null) {
  return useQuery({
    queryKey: MINISTRY_QUERY_KEYS.detail(ministryId ?? ""),
    queryFn: () => getMinistryByIdAction(ministryId!),
    enabled: !!ministryId,
    staleTime: 30_000,
  });
}

export function useCreateMinistry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CreateMinistryFormValues) =>
      createMinistryAction(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MINISTRY_QUERY_KEYS.all });
    },
  });
}

export function useUpdateMinistry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ministryId,
      values,
    }: {
      ministryId: string;
      values: UpdateMinistryFormValues;
    }) => updateMinistryAction(ministryId, values),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: MINISTRY_QUERY_KEYS.all });
      queryClient.invalidateQueries({
        queryKey: MINISTRY_QUERY_KEYS.detail(variables.ministryId),
      });
    },
  });
}

export function useDeactivateMinistry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ministryId: string) => deactivateMinistryAction(ministryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MINISTRY_QUERY_KEYS.all });
    },
  });
}
