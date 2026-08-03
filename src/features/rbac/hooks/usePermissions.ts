"use client";

import { useAccessState, type UseAccessStateResult } from "./useAccessState";

export type UsePermissionsResult = UseAccessStateResult;

export { RBAC_QUERY_KEYS } from "./useAccessState";

export function usePermissions(): UsePermissionsResult {
  return useAccessState();
}
