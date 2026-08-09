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
 * Gate for updating/deactivating users and changing role/stage grants. The PO
 * holds tenants.* and users.read (but NOT users.update / servants.delete /
 * servants.assign), so it is gated on the platform tenants bundle; church
 * actors keep the existing permission model. RPCs (change_church_manager,
 * deactivate_church_user, create_church_user) remain the hard boundary where
 * they are used.
 */
export async function assertUserAdminPermission(
  ctx: ActorContext,
  permission: "update" | "deactivate" | "assign",
): Promise<{ ok: true } | { ok: false; message: string }> {
  const deny = (label: string) => ({
    ok: false as const,
    message: `You do not have permission to ${label} users.`,
  });

  if (ctx.churchId === null) {
    const allowed = await hasAnyPermission([
      PERMISSION_CODES.USERS_READ,
      PERMISSION_CODES.TENANTS_UPDATE,
    ]);
    return allowed ? { ok: true } : deny("manage");
  }

  const code =
    permission === "update"
      ? PERMISSION_CODES.USERS_UPDATE
      : permission === "deactivate"
        ? PERMISSION_CODES.SERVANTS_DELETE
        : PERMISSION_CODES.SERVANTS_ASSIGN;
  const allowed = await hasPermission(code);
  return allowed ? { ok: true } : deny("manage");
}

/**
 * Resolves the target church for a user-management operation. Church-scoped
 * actors are hard-locked to their own church (a requested churchId for another
 * tenant is rejected); the PO must supply an explicit churchId. Mirrors
 * resolveTargetChurch in the import-export actions.
 */
export async function resolveUserManagementChurch(
  ctx: ActorContext,
  churchId?: string,
): Promise<{ churchId: string | null; message: string | null }> {
  if (ctx.churchId !== null) {
    if (churchId && churchId !== ctx.churchId) {
      return { churchId: null, message: "You cannot manage users in another church." };
    }
    return { churchId: ctx.churchId, message: null };
  }

  if (!churchId) {
    return { churchId: null, message: "A church must be selected." };
  }

  const { data: church } = await ctx.admin
    .from("churches")
    .select("id, status")
    .eq("id", churchId)
    .is("deleted_at", null)
    .single();

  if (!church || church.status !== "active") {
    return { churchId: null, message: "The selected church is not available." };
  }

  return { churchId, message: null };
}

/**
 * Audit writer that records the actor + explicit church scope directly through
 * the admin client. writeAuditLog (lib/audit.ts) derives church_id from the
 * session profile, which fails for the PO (NULL church_id, no RLS path).
 * `oldValues` is optional and captured for update-style actions so audit.read
 * consumers can diff before/after state.
 */
export async function writeUserAudit(
  ctx: ActorContext,
  churchId: string,
  action: string,
  entityType: string,
  entityId: string,
  newValues: Record<string, unknown> | null,
  oldValues: Record<string, unknown> | null = null,
): Promise<void> {
  try {
    await ctx.admin.from("audit_logs").insert({
      church_id: churchId,
      actor_id: ctx.userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values: (oldValues ?? null) as Json | null,
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
