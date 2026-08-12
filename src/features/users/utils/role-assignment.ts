import type { Role } from "@/features/rbac/types/rbac.types";

export type RoleAssignmentResult = {
  /** Exactly zero or one role: the servant's primary role. */
  roleIds: string[];
  /** Service assignments for the selected role (single service for servant /
   * stage_manager, multiple allowed for admin). */
  serviceIds: string[];
  /** Stage assignments (only servant requires exactly one). */
  stageIds: string[];
};

export type RoleOption = Pick<Role, "id" | "role_type">;

/**
 * Resolves the assignment fields that are valid for a single selected role
 * (050 rules):
 *   servant        -> one service + one stage inside that service
 *   stage_manager  -> one service, no stage
 *   admin          -> one or more services, no stage
 *   super_admin / platform_owner -> no service/stage assignments
 *
 * Stale values that violate the newly selected role are cleared:
 *   - switching away from servant drops the stage selection;
 *   - switching to servant / stage_manager keeps only the first service;
 *   - switching to admin keeps any multi-service selection.
 */
export function resolveRoleAssignments(
  roles: RoleOption[],
  selectedRoleId: string | null | undefined,
  currentServiceIds: string[],
  currentStageIds: string[],
): RoleAssignmentResult {
  const roleIds = selectedRoleId ? [selectedRoleId] : [];
  const role = roles.find((r) => r.id === selectedRoleId);
  const roleType = role?.role_type;

  let serviceIds = [...currentServiceIds];
  let stageIds = [...currentStageIds];

  // Only servant keeps a stage; every other role must drop it.
  if (roleType !== "servant") {
    stageIds = [];
  }

  // servant / stage_manager allow exactly one service.
  if (roleType === "servant" || roleType === "stage_manager") {
    serviceIds = serviceIds.slice(0, 1);
  }

  return { roleIds, serviceIds, stageIds };
}
