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
    queryFn: () => listChurchesForSignupAction(),
    staleTime: 60_000,
  });
}
