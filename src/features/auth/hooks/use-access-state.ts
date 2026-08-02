"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyAccessStateAction } from "../actions/access.actions";

export const ACCESS_QUERY_KEYS = {
  state: ["access", "state"] as const,
};

export function useAccessState() {
  return useQuery({
    queryKey: ACCESS_QUERY_KEYS.state,
    queryFn: () => getMyAccessStateAction(),
    staleTime: 30_000,
  });
}
