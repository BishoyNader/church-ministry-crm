"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApprovalCenterStatsAction, approveServantWithProvisionAction } from "../actions/approval-center.actions";
import { APPROVAL_QUERY_KEYS } from "@/features/users/hooks/use-approvals";
import { SERVANT_QUERY_KEYS } from "@/features/servants/hooks/use-servants";

export const APPROVAL_CENTER_QUERY_KEYS = {
  stats: ["approvals", "stats"] as const,
};

export function useApprovalCenterStats() {
  return useQuery({
    queryKey: APPROVAL_CENTER_QUERY_KEYS.stats,
    queryFn: async () => {
      const result = await getApprovalCenterStatsAction();
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load approval stats.");
      }
      return result;
    },
    staleTime: 30_000,
  });
}

export function useApproveServantWithProvision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      servantId,
      roleIds,
      stageIds,
    }: {
      servantId: string;
      roleIds: string[];
      stageIds: string[];
    }) => approveServantWithProvisionAction(servantId, roleIds, stageIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPROVAL_CENTER_QUERY_KEYS.stats });
      queryClient.invalidateQueries({ queryKey: APPROVAL_QUERY_KEYS.pending });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: SERVANT_QUERY_KEYS.all });
    },
  });
}
