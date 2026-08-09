import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import { createLogger } from "@/lib/logger";

const log = createLogger("audit");

export interface AuditMetadata {
  reason?: string;
  [key: string]: unknown;
}

export async function writeAuditLog(
  supabase: SupabaseClient<Database>,
  action: string,
  entityType: string,
  entityId: string,
  oldValues?: Record<string, unknown> | null,
  newValues?: Record<string, unknown> | null,
  metadata?: AuditMetadata | null,
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("church_id")
      .eq("id", user.id)
      .single();

    if (!profile) return;

    const { error } = await supabase.from("audit_logs").insert({
      church_id: profile.church_id,
      actor_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values: (oldValues ?? null) as Json | null,
      new_values: (newValues ?? null) as Json | null,
      metadata: (metadata ?? {}) as Json,
    });

    if (error) {
      await log.error("audit_write_failed", {
        entityType,
        entityId,
        action,
        message: error.message,
      });
    }
  } catch (err) {
    await log.error("audit_write_unexpected", {
      entityType,
      entityId,
      action,
      err,
    });
  }
}
