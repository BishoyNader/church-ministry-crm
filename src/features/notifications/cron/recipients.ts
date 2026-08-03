import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Recipient-resolution helpers for the scheduled automation. Every lookup is
 * church-scoped or platform-scoped (roles with church_id IS NULL) so the
 * service-role client never leaks across tenants.
 */

/**
 * Current assigned servants (beneficiary_assignments.is_current = true) per
 * beneficiary id. Returns a map of beneficiary_id -> servant/profile ids.
 */
export async function getAssignedServants(
  admin: SupabaseClient,
  churchId: string,
  beneficiaryIds: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (beneficiaryIds.length === 0) return result;

  const { data } = await admin
    .from("beneficiary_assignments")
    .select("beneficiary_id, servant_id")
    .eq("church_id", churchId)
    .eq("is_current", true)
    .in("beneficiary_id", beneficiaryIds);

  for (const assignment of data ?? []) {
    if (!assignment.servant_id) continue;
    const existing = result.get(assignment.beneficiary_id) ?? [];
    if (!existing.includes(assignment.servant_id)) {
      existing.push(assignment.servant_id);
    }
    result.set(assignment.beneficiary_id, existing);
  }

  return result;
}

/**
 * Super-admin (and above) recipients per church, resolved from active role
 * grants. servants.id references profiles.id, so a servant id is a valid
 * notifications.recipient_id.
 */
export async function getSuperAdminRecipients(
  admin: SupabaseClient,
  churchIds: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (churchIds.length === 0) return result;

  const { data: roles } = await admin
    .from("roles")
    .select("id, church_id")
    .in("church_id", churchIds)
    .in("role_type", ["super_admin", "admin"]);

  if (!roles?.length) return result;

  const roleIds = roles.map((role) => role.id);
  const { data: grants } = await admin
    .from("user_roles")
    .select("user_id, role_id")
    .in("role_id", roleIds)
    .is("end_date", null);

  const churchByRole = new Map(roles.map((role) => [role.id, role.church_id]));

  for (const grant of grants ?? []) {
    const churchId = churchByRole.get(grant.role_id);
    if (!churchId) continue;
    const existing = result.get(churchId) ?? [];
    if (!existing.includes(grant.user_id)) {
      existing.push(grant.user_id);
    }
    result.set(churchId, existing);
  }

  return result;
}

/**
 * Active platform-owner recipients (global roles with church_id IS NULL).
 * Platform owners receive new-church-request approval reminders.
 */
export async function getPlatformOwnerRecipients(
  admin: SupabaseClient,
): Promise<string[]> {
  const { data: roles } = await admin
    .from("roles")
    .select("id")
    .is("church_id", null)
    .eq("role_type", "platform_owner");

  if (!roles?.length) return [];

  const roleIds = roles.map((role) => role.id);
  const { data: grants } = await admin
    .from("user_roles")
    .select("user_id")
    .in("role_id", roleIds)
    .is("end_date", null);

  return [...new Set((grants ?? []).map((grant) => grant.user_id))];
}
