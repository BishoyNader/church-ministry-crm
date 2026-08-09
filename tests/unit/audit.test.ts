import { describe, expect, it, vi } from "vitest";
import { writeAuditLog } from "@/lib/audit";

type MockChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
};

function createMockSupabase() {
  const chains: Record<string, MockChain> = {};

  const getChain = (table: string): MockChain => {
    if (!chains[table]) {
      chains[table] = {
        select: vi.fn(function (this: unknown) {
          return this;
        }),
        eq: vi.fn(function (this: unknown) {
          return this;
        }),
        single: vi.fn(),
        insert: vi.fn(),
      };
    }
    return chains[table];
  };

  const supabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn((table: string) => getChain(table)),
  };

  return { supabase, getChain };
}

describe("writeAuditLog", () => {
  it("writes an audit row with the actor's church scope", async () => {
    const { supabase, getChain } = createMockSupabase();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    getChain("profiles").single.mockResolvedValue({
      data: { church_id: "church-1" },
      error: null,
    });
    getChain("audit_logs").insert.mockResolvedValue({ error: null });

    await writeAuditLog(
      supabase as never,
      "update",
      "beneficiary",
      "beneficiary-1",
      { status: "old" },
      { status: "new" },
      { reason: "test" },
    );

    expect(getChain("audit_logs").insert).toHaveBeenCalledWith(
      expect.objectContaining({
        church_id: "church-1",
        actor_id: "user-1",
        action: "update",
        entity_type: "beneficiary",
        entity_id: "beneficiary-1",
        old_values: { status: "old" },
        new_values: { status: "new" },
        metadata: { reason: "test" },
      }),
    );
  });

  it("does not write when there is no session", async () => {
    const { supabase, getChain } = createMockSupabase();
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await writeAuditLog(supabase as never, "create", "church", "c1");

    expect(getChain("audit_logs").insert).not.toHaveBeenCalled();
  });

  it("does not write when the actor has no profile", async () => {
    const { supabase, getChain } = createMockSupabase();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    getChain("profiles").single.mockResolvedValue({ data: null, error: null });

    await writeAuditLog(supabase as never, "create", "church", "c1");

    expect(getChain("audit_logs").insert).not.toHaveBeenCalled();
  });

  it("swallows database errors (audit is best-effort)", async () => {
    const { supabase, getChain } = createMockSupabase();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    getChain("profiles").single.mockResolvedValue({
      data: { church_id: "church-1" },
      error: null,
    });
    getChain("audit_logs").insert.mockResolvedValue({ error: { message: "boom" } });

    await expect(
      writeAuditLog(supabase as never, "create", "church", "c1"),
    ).resolves.toBeUndefined();
  });
});
