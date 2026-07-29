"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listFollowupsAction,
  createFollowupAction,
  updateFollowupAction,
} from "../actions/child.actions";
import type {
  CreateFollowupFormValues,
  UpdateFollowupFormValues,
} from "../schemas/child.schema";
import { CHILD_QUERY_KEYS } from "./use-children";

export const FOLLOWUP_QUERY_KEYS = {
  all: ["followups"] as const,
  list: (filters?: {
    child_id?: string;
    status?: string;
    assigned_to?: string;
  }) => ["followups", "list", filters] as const,
};

export function useFollowupList(filters?: {
  child_id?: string;
  status?: string;
  assigned_to?: string;
}) {
  return useQuery({
    queryKey: FOLLOWUP_QUERY_KEYS.list(filters),
    queryFn: () => listFollowupsAction(filters),
    staleTime: 30_000,
  });
}

export function useCreateFollowup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CreateFollowupFormValues) =>
      createFollowupAction(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLLOWUP_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CHILD_QUERY_KEYS.all });
    },
  });
}

export function useUpdateFollowup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      followupId,
      values,
    }: {
      followupId: string;
      values: UpdateFollowupFormValues;
    }) => updateFollowupAction(followupId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLLOWUP_QUERY_KEYS.all });
    },
  });
}
