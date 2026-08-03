"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listServantsAction,
  getServantAction,
  updateServantAction,
  assignServantStagesAction,
  archiveServantAction,
  getServantStagesAction,
} from "../actions/servant.actions";
import {
  approveServantAction,
  rejectServantAction,
} from "@/features/users/actions/approval.actions";
import type { UpdateServantFormValues } from "../schemas/servant.schema";

export const SERVANT_QUERY_KEYS = {
  all: ["servants"] as const,
  list: (params: { page: number; pageSize: number; search?: string; approvalStatus?: string }) =>
    ["servants", "list", params] as const,
  detail: (id: string) => ["servants", "detail", id] as const,
  stages: ["servants", "stages"] as const,
};

export function useServantList(params: {
  page: number;
  pageSize: number;
  search?: string;
  approvalStatus?: string;
}) {
  return useQuery({
    queryKey: SERVANT_QUERY_KEYS.list(params),
    queryFn: () =>
      listServantsAction(params.page, params.pageSize, params.search, params.approvalStatus),
    staleTime: 30_000,
  });
}

export function useServantDetail(servantId: string | null) {
  return useQuery({
    queryKey: SERVANT_QUERY_KEYS.detail(servantId ?? ""),
    queryFn: () => getServantAction(servantId!),
    enabled: !!servantId,
    staleTime: 30_000,
  });
}

export function useServantStages() {
  return useQuery({
    queryKey: SERVANT_QUERY_KEYS.stages,
    queryFn: () => getServantStagesAction(),
    staleTime: 60_000,
  });
}

export function useUpdateServant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ servantId, values }: { servantId: string; values: UpdateServantFormValues }) =>
      updateServantAction(servantId, values),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: SERVANT_QUERY_KEYS.all });
      queryClient.invalidateQueries({
        queryKey: SERVANT_QUERY_KEYS.detail(variables.servantId),
      });
    },
  });
}

export function useAssignServantStages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ servantId, stageIds }: { servantId: string; stageIds: string[] }) =>
      assignServantStagesAction(servantId, stageIds),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: SERVANT_QUERY_KEYS.all });
      queryClient.invalidateQueries({
        queryKey: SERVANT_QUERY_KEYS.detail(variables.servantId),
      });
    },
  });
}

export function useArchiveServant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (servantId: string) => archiveServantAction(servantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVANT_QUERY_KEYS.all });
    },
  });
}

export function useApproveServant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (servantId: string) => approveServantAction(servantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVANT_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["users", "approvals", "pending"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useRejectServant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ servantId, reason }: { servantId: string; reason?: string }) =>
      rejectServantAction(servantId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVANT_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["users", "approvals", "pending"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
