"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyAccessStateAction } from "../actions/access.actions";

export const ACCESS_QUERY_KEYS = {
  state: ["access", "state"] as const,
};

export function useAccessState() {
  return useQuery({
    queryKey: ACCESS_QUERY_KEYS.state,
    queryFn: async () => {
      const result = await getMyAccessStateAction();
      if (result.error) {
        throw new Error(result.error ?? "Failed to load access state.");
      }
      return result;
    },
    staleTime: 30_000,
  });
}
