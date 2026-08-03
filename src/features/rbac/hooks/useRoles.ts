"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { RbacError, Role } from "../types/rbac.types";
import { useAccessState } from "./useAccessState";

export type UseRolesResult = UseQueryResult<Role[] | null, Error> & {
  error: RbacError | null;
};

export { RBAC_QUERY_KEYS } from "./useAccessState";

export function useRoles(): UseRolesResult {
  const state = useAccessState();

  return {
    ...state,
    data: state.data?.roles ?? null,
  } as UseRolesResult;
}
