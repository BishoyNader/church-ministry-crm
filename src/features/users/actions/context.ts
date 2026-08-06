import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hasPermission,
  hasAnyPermission,
} from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import type { Json } from "@/types/database.types";

export type ActorContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  churchId: string | null;
};

/**
 * resolveActorContext — resolves the acting user's identity. The profile is
 * read through the admin client so that the PO (church_id NULL, no RLS path to
 * their own profile) resolves identically to a church super_admin.
 */
export async function resolveActorContext(): Promise<ActorContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("church_id")
    .eq("id", user.id)
    .single();

  return { supabase, admin, userId: user.id, churchId: profile?.church_id ?? null };
}

/**
 * Church-scoped data client. Super admins read through the RLS-bound session
 * client; the PO has no platform_owner policies on the user tables (022/028),
 * so PO reads use the admin client (mirrors church-admin.actions.ts).
 */
export function dataClientFor(ctx: ActorContext) {
  return ctx.churchId ? ctx.supabase : ctx.admin;
}

/**
 * Gate shared by single-user creation and bulk import. Super admins hold
 * servants.create; the PO has no servants.* permission, so it is gated on the
 * platform-scoped tenants/users bundle. The RPC's internal
 * user_is_platform_owner() / user_is_super_admin() guard remains the hard
 * enforcement boundary.
 */
export async function assertUserManagementPermission(
  ctx: ActorContext,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (ctx.churchId === null) {
    const allowed = await hasAnyPermission([
      PERMISSION_CODES.USERS_READ,
      PERMISSION_CODES.TENANTS_READ,
    ]);
    if (!allowed) {
      return { ok: false, message: "You do not have permission to manage users." };
    }
    return { ok: true };
  }

  const allowed = await hasPermission(PERMISSION_CODES.SERVANTS_CREATE);
  if (!allowed) {
    return { ok: false, message: "You do not have permission to manage users." };
  }
  return { ok: true };
}

/**
 * Audit writer that records the actor + explicit church scope directly through
 * the admin client. writeAuditLog (lib/audit.ts) derives church_id from the
 * session profile, which fails for the PO (NULL church_id, no RLS path).
 */
export async function writeUserAudit(
  ctx: ActorContext,
  churchId: string,
  action: string,
  entityType: string,
  entityId: string,
  newValues: Record<string, unknown> | null,
): Promise<void> {
  try {
    await ctx.admin.from("audit_logs").insert({
      church_id: churchId,
      actor_id: ctx.userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values: null,
      new_values: (newValues ?? null) as Json | null,
      metadata: {},
    });
  } catch (err) {
    console.error(
      `[users] Failed to write audit log ${entityType}:${entityId}:`,
      err,
    );
  }
}
