"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listStagesAction,
  createStageAction,
  updateStageAction,
  deactivateStageAction,
  getStageUsersAction,
  assignUsersToStageAction,
  listAllUsersAction,
} from "../actions/stage.actions";
import { MINISTRY_QUERY_KEYS } from "./use-ministries";
import type {
  CreateStageFormValues,
  UpdateStageFormValues,
  AssignUsersToStageFormValues,
} from "../schemas/stage.schema";

export const STAGE_QUERY_KEYS = {
  all: ["stages"] as const,
  list: (ministryId?: string) =>
    ["stages", "list", { ministryId }] as const,
  detail: (id: string) => ["stages", "detail", id] as const,
  stageUsers: (stageId: string) => ["stages", "users", stageId] as const,
  allUsers: () => ["stages", "allUsers"] as const,
};

export function useStageList(ministryId?: string) {
  return useQuery({
    queryKey: STAGE_QUERY_KEYS.list(ministryId),
    queryFn: () => listStagesAction(ministryId),
    staleTime: 30_000,
  });
}

export function useCreateStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CreateStageFormValues) => createStageAction(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STAGE_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: MINISTRY_QUERY_KEYS.all });
    },
  });
}

export function useUpdateStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      stageId,
      values,
    }: {
      stageId: string;
      values: UpdateStageFormValues;
    }) => updateStageAction(stageId, values),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: STAGE_QUERY_KEYS.all });
      queryClient.invalidateQueries({
        queryKey: STAGE_QUERY_KEYS.detail(variables.stageId),
      });
      queryClient.invalidateQueries({ queryKey: MINISTRY_QUERY_KEYS.all });
    },
  });
}

export function useDeactivateStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (stageId: string) => deactivateStageAction(stageId),
    onSuccess: (_data, stageId) => {
      queryClient.invalidateQueries({ queryKey: STAGE_QUERY_KEYS.all });
      queryClient.invalidateQueries({
        queryKey: STAGE_QUERY_KEYS.detail(stageId),
      });
      queryClient.invalidateQueries({ queryKey: MINISTRY_QUERY_KEYS.all });
    },
  });
}

export function useStageUsers(stageId: string | null) {
  return useQuery({
    queryKey: STAGE_QUERY_KEYS.stageUsers(stageId ?? ""),
    queryFn: () => getStageUsersAction(stageId!),
    enabled: !!stageId,
    staleTime: 30_000,
  });
}

export function useAllUsers() {
  return useQuery({
    queryKey: STAGE_QUERY_KEYS.allUsers(),
    queryFn: () => listAllUsersAction(),
    staleTime: 60_000,
  });
}

export function useAssignUsersToStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: AssignUsersToStageFormValues) =>
      assignUsersToStageAction(values),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: STAGE_QUERY_KEYS.all });
      queryClient.invalidateQueries({
        queryKey: STAGE_QUERY_KEYS.stageUsers(variables.stageId),
      });
    },
  });
}
