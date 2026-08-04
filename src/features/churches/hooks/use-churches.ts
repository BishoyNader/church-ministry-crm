"use client";

import { useQuery } from "@tanstack/react-query";
import { listChurchesForSignupAction } from "../actions/church.actions";

export const CHURCH_QUERY_KEYS = {
  all: ["churches"] as const,
  signup: ["churches", "signup"] as const,
};

export function useChurchesForSignup() {
  return useQuery({
    queryKey: CHURCH_QUERY_KEYS.signup,
    queryFn: async () => {
      const result = await listChurchesForSignupAction();
      if (result.error) {
        throw new Error(result.error ?? "Failed to load churches.");
      }
      return result;
    },
    staleTime: 60_000,
  });
}
