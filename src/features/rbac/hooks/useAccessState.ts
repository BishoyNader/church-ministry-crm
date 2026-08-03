"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getCurrentUserAccessState } from "../services/rbac.service";
import type { Permission, RbacError, Role } from "../types/rbac.types";

export const RBAC_QUERY_KEYS = {
  access: ["rbac", "access"] as const,
} as const;

export type AccessState = {
  permissions: Permission[];
  roles: Role[];
};

export type UseAccessStateResult = UseQueryResult<AccessState | null, Error> & {
  error: RbacError | null;
};

// Single source of truth for the current user's RBAC state. Both
// usePermissions and useRoles derive from this one query so the full
// permission + role set is fetched exactly once per mount tree.
export function useAccessState(): UseAccessStateResult {
  const query = useQuery({
    queryKey: RBAC_QUERY_KEYS.access,
    queryFn: async () => {
      const { data, error } = await getCurrentUserAccessState();
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
  } as UseAccessStateResult;
}
