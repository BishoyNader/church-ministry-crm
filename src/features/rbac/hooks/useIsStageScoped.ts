"use client";

import { useAccessState } from "./useAccessState";

const STAGE_SCOPED_ROLES = new Set(["servant", "stage_manager"]);

// True when the current actor's roles are all stage-scoped (servant /
// stage_manager). Admins and super admins are church-wide.
export function useIsStageScoped(): boolean {
  const { data: accessState } = useAccessState();
  const roles = accessState?.roles ?? [];

  return (
    roles.length > 0 &&
    roles.every((role) => STAGE_SCOPED_ROLES.has(role.role_type))
  );
}
