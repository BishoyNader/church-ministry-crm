import { describe, expect, it } from "vitest";
import { splitManagerReplacementRoles } from "@/features/users/services/user.service";

const SUPER_ADMIN = "role-super-admin";
const SERVANT = "role-servant";
const ADMIN = "role-admin";

describe("splitManagerReplacementRoles — single Church Manager invariant", () => {
  it("keeps roles unchanged when super_admin is not requested", () => {
    const result = splitManagerReplacementRoles([ADMIN, SERVANT], SUPER_ADMIN, SERVANT);
    expect(result).toEqual({ initialRoleIds: [ADMIN, SERVANT], placeholderRoleId: null });
  });

  it("keeps roles unchanged when no super_admin role exists in the church", () => {
    const result = splitManagerReplacementRoles([SUPER_ADMIN], null, SERVANT);
    expect(result).toEqual({ initialRoleIds: [SUPER_ADMIN], placeholderRoleId: null });
  });

  it("drops super_admin from the initial grant when other roles are requested", () => {
    const result = splitManagerReplacementRoles(
      [SUPER_ADMIN, ADMIN],
      SUPER_ADMIN,
      SERVANT,
    );
    expect(result).toEqual({ initialRoleIds: [ADMIN], placeholderRoleId: null });
  });

  it("uses the servant role as a placeholder when super_admin was the ONLY requested role", () => {
    const result = splitManagerReplacementRoles([SUPER_ADMIN], SUPER_ADMIN, SERVANT);
    expect(result).toEqual({ initialRoleIds: [SERVANT], placeholderRoleId: SERVANT });
  });

  it("returns an empty initial set when super_admin was the only role and no placeholder exists", () => {
    const result = splitManagerReplacementRoles([SUPER_ADMIN], SUPER_ADMIN, null);
    expect(result).toEqual({ initialRoleIds: [], placeholderRoleId: null });
  });

  it("handles an empty request", () => {
    const result = splitManagerReplacementRoles([], SUPER_ADMIN, SERVANT);
    expect(result).toEqual({ initialRoleIds: [], placeholderRoleId: null });
  });
});
