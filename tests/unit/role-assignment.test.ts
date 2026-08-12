import { describe, expect, it } from "vitest";
import { resolveRoleAssignments } from "@/features/users/utils/role-assignment";
import type { RoleOption } from "@/features/users/utils/role-assignment";

const ROLES: RoleOption[] = [
  { id: "role-admin", role_type: "admin" },
  { id: "role-stage-manager", role_type: "stage_manager" },
  { id: "role-servant", role_type: "servant" },
  { id: "role-super-admin", role_type: "super_admin" },
];

describe("resolveRoleAssignments — single primary role (050 rules)", () => {
  it("selecting servant keeps exactly one service and one stage", () => {
    const result = resolveRoleAssignments(
      ROLES,
      "role-servant",
      ["service-1", "service-2"],
      ["stage-1"],
    );
    expect(result).toEqual({
      roleIds: ["role-servant"],
      serviceIds: ["service-1"],
      stageIds: ["stage-1"],
    });
  });

  it("selecting stage_manager keeps one service and drops the stage", () => {
    const result = resolveRoleAssignments(
      ROLES,
      "role-stage-manager",
      ["service-1", "service-2"],
      ["stage-1"],
    );
    expect(result).toEqual({
      roleIds: ["role-stage-manager"],
      serviceIds: ["service-1"],
      stageIds: [],
    });
  });

  it("selecting admin keeps multiple services and drops the stage", () => {
    const result = resolveRoleAssignments(
      ROLES,
      "role-admin",
      ["service-1", "service-2"],
      ["stage-1"],
    );
    expect(result).toEqual({
      roleIds: ["role-admin"],
      serviceIds: ["service-1", "service-2"],
      stageIds: [],
    });
  });

  it("super_admin / platform-level roles clear service and stage assignments", () => {
    const result = resolveRoleAssignments(
      ROLES,
      "role-super-admin",
      ["service-1"],
      ["stage-1"],
    );
    expect(result).toEqual({
      roleIds: ["role-super-admin"],
      serviceIds: ["service-1"],
      stageIds: [],
    });
  });

  it("an empty selection produces no roles and clears assignments", () => {
    const result = resolveRoleAssignments(
      ROLES,
      null,
      ["service-1", "service-2"],
      ["stage-1"],
    );
    expect(result).toEqual({ roleIds: [], serviceIds: ["service-1", "service-2"], stageIds: [] });
  });

  it("changing from servant to stage_manager clears the stage (stale value removal)", () => {
    const servantSelection = resolveRoleAssignments(
      ROLES,
      "role-servant",
      ["service-1"],
      ["stage-1"],
    );
    const switched = resolveRoleAssignments(
      ROLES,
      "role-stage-manager",
      servantSelection.serviceIds,
      servantSelection.stageIds,
    );
    expect(switched.stageIds).toEqual([]);
    expect(switched.serviceIds).toEqual(["service-1"]);
  });

  it("changing from stage_manager to admin keeps the single service and no stage", () => {
    const result = resolveRoleAssignments(
      ROLES,
      "role-admin",
      ["service-1"],
      [],
    );
    expect(result).toEqual({
      roleIds: ["role-admin"],
      serviceIds: ["service-1"],
      stageIds: [],
    });
  });
});
