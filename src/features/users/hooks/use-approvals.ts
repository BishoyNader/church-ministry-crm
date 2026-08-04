"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listPendingRegistrationsAction,
  approveServantAction,
  rejectServantAction,
} from "../actions/approval.actions";
import { APPROVAL_CENTER_QUERY_KEYS } from "@/features/approvals/hooks/use-approval-center";
import { SERVANT_QUERY_KEYS } from "@/features/servants/hooks/use-servants";

export const APPROVAL_QUERY_KEYS = {
  pending: ["users", "approvals", "pending"] as const,
};

export function usePendingRegistrations() {
  return useQuery({
    queryKey: APPROVAL_QUERY_KEYS.pending,
    queryFn: async () => {
      const result = await listPendingRegistrationsAction();
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load pending registrations.");
      }
      return result;
    },
    staleTime: 15_000,
  });
}

export function useApproveServant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (servantId: string) => approveServantAction(servantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPROVAL_QUERY_KEYS.pending });
      queryClient.invalidateQueries({ queryKey: APPROVAL_CENTER_QUERY_KEYS.stats });
      queryClient.invalidateQueries({ queryKey: SERVANT_QUERY_KEYS.all });
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
      queryClient.invalidateQueries({ queryKey: APPROVAL_QUERY_KEYS.pending });
      queryClient.invalidateQueries({ queryKey: APPROVAL_CENTER_QUERY_KEYS.stats });
      queryClient.invalidateQueries({ queryKey: SERVANT_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
