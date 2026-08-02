"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listChurchRequestsAction,
  approveChurchRequestAction,
  rejectChurchRequestAction,
} from "../actions/church-request.admin.actions";
import type { ChurchRequestStatus } from "../types/church-request.admin.types";

export const CHURCH_REQUEST_QUERY_KEYS = {
  all: ["churches", "requests"] as const,
  list: (status: ChurchRequestStatus) => ["churches", "requests", status] as const,
};

export function useChurchRequests(status: ChurchRequestStatus) {
  return useQuery({
    queryKey: CHURCH_REQUEST_QUERY_KEYS.list(status),
    queryFn: () => listChurchRequestsAction(status),
    staleTime: 15_000,
  });
}

export function useApproveChurchRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => approveChurchRequestAction(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHURCH_REQUEST_QUERY_KEYS.all });
    },
  });
}

export function useRejectChurchRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason?: string }) =>
      rejectChurchRequestAction(requestId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHURCH_REQUEST_QUERY_KEYS.all });
    },
  });
}
