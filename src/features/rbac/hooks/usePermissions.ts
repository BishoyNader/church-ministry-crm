"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getCurrentUserPermissions } from "../services/rbac.service";
import type { Permission, RbacError, Role } from "../types/rbac.types";

export const RBAC_QUERY_KEYS = {
  permissions: ["rbac", "permissions"] as const,
  roles: ["rbac", "roles"] as const,
} as const;

export type UsePermissionsResult = UseQueryResult<
  {
    permissions: Permission[];
    roles: Role[];
  } | null,
  Error
> & {
  error: RbacError | null;
};

export function usePermissions(): UsePermissionsResult {
  const query = useQuery({
    queryKey: RBAC_QUERY_KEYS.permissions,
    queryFn: async () => {
      const { data, error } = await getCurrentUserPermissions();
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
  } as UsePermissionsResult;
}
