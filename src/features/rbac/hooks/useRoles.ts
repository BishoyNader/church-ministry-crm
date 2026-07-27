"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getCurrentUserRoles } from "../services/rbac.service";
import type { RbacError, Role } from "../types/rbac.types";
import { RBAC_QUERY_KEYS } from "./usePermissions";

export type UseRolesResult = UseQueryResult<Role[] | null, Error> & {
  error: RbacError | null;
};

export function useRoles(): UseRolesResult {
  const query = useQuery({
    queryKey: RBAC_QUERY_KEYS.roles,
    queryFn: async () => {
      const { data, error } = await getCurrentUserRoles();
      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    retry: false,
    staleTime: 60_000,
  });

  return {
    ...query,
    error: query.error ? { code: "service-error", message: query.error.message } : null,
  } as UseRolesResult;
}
