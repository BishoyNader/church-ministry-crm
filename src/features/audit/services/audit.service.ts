import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  AuditFilterOptions,
  AuditFilters,
  AuditLogEntry,
  AuditPageData,
} from "../types/audit.types";

export const AUDIT_ACTION_CODES = [
  "create",
  "update",
  "delete",
  "read",
  "login",
  "logout",
  "import",
  "export",
  "cron",
] as const;

const DEFAULT_PAGE_SIZE = 20;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[()!,]/g, " ")
    .replace(/[%_\\]/g, (match) => `\\${match}`)
    .replace(/\s+/g, " ")
    .trim();
}

type AuditLogRow = {
  id: string;
  church_id: string | null;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values: unknown;
  new_values: unknown;
  metadata: unknown;
  created_at: string;
  profiles?: {
    full_name_ar?: string | null;
    full_name_en?: string | null;
    email?: string | null;
  } | null;
};

function mapAuditRow(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    churchId: row.church_id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    oldValues: row.old_values,
    newValues: row.new_values,
    metadata: row.metadata,
    createdAt: row.created_at,
    actorName: row.profiles?.full_name_ar ?? row.profiles?.full_name_en ?? null,
    actorEmail: row.profiles?.email ?? null,
  };
}

export async function getAuditPage(
  supabase: SupabaseClient<Database>,
  churchId: string | null,
  filters: AuditFilters = {},
): Promise<{ data: AuditPageData | null; error: string | null }> {
  try {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
    const from = (page - 1) * pageSize;
    const to = page * pageSize - 1;

    let query = supabase
      .from("audit_logs")
      .select(
        "id, church_id, actor_id, action, entity_type, entity_id, old_values, new_values, metadata, created_at, profiles(full_name_ar, full_name_en, email)",
        { count: "exact" },
      );

    if (churchId) {
      query = query.eq("church_id", churchId);
    } else {
      query = query.is("church_id", null);
    }

    if (filters.fromDate) {
      query = query.gte("created_at", `${filters.fromDate}T00:00:00.000Z`);
    }
    if (filters.toDate) {
      query = query.lte("created_at", `${filters.toDate}T23:59:59.999Z`);
    }
    if (filters.action) {
      query = query.eq("action", filters.action);
    }
    if (filters.entityType) {
      query = query.eq("entity_type", filters.entityType);
    }
    if (filters.actorId) {
      query = query.eq("actor_id", filters.actorId);
    }

    const search = filters.search?.trim();
    if (search) {
      if (UUID_PATTERN.test(search)) {
        query = query.eq("entity_id", search);
      } else if (churchId) {
        const pattern = sanitizeSearchTerm(search);
        if (!pattern) return { data: null, error: "Invalid search term." };

        const { data: actors, error: actorsError } = await supabase
          .from("profiles")
          .select("id")
          .eq("church_id", churchId)
          .or(`full_name_ar.ilike.%${pattern}%,full_name_en.ilike.%${pattern}%`);

        if (actorsError) return { data: null, error: actorsError.message };

        const actorIds = (actors ?? []).map((actor) => actor.id);
        if (actorIds.length === 0) {
          return {
            data: { rows: [], total: 0, page, pageSize, totalPages: 0 },
            error: null,
          };
        }
        query = query.in("actor_id", actorIds);
      }
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) return { data: null, error: error.message };

    const total = count ?? 0;
    return {
      data: {
        rows: (data ?? []).map(mapAuditRow),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to load audit log." };
  }
}

export async function getAuditFilterOptions(
  supabase: SupabaseClient<Database>,
  churchId: string | null,
): Promise<{ data: AuditFilterOptions | null; error: string | null }> {
  try {
    let entityQuery = supabase.from("audit_logs").select("entity_type");
    if (churchId) {
      entityQuery = entityQuery.eq("church_id", churchId);
    } else {
      entityQuery = entityQuery.is("church_id", null);
    }

    let actorsQuery = supabase
      .from("profiles")
      .select("id, full_name_ar, full_name_en, email");
    if (churchId) {
      actorsQuery = actorsQuery.eq("church_id", churchId);
    } else {
      actorsQuery = actorsQuery.is("church_id", null);
    }

    const [entityResult, actorsResult] = await Promise.all([entityQuery, actorsQuery]);

    if (entityResult.error) return { data: null, error: entityResult.error.message };
    if (actorsResult.error) return { data: null, error: actorsResult.error.message };

    const entityTypes = Array.from(
      new Map(
        (entityResult.data ?? [])
          .map((row) => row.entity_type)
          .filter(Boolean)
          .map((value) => [value, { value, label: value }]),
      ).values(),
    ).sort((a, b) => a.label.localeCompare(b.label));

    const actors = (actorsResult.data ?? [])
      .map((actor) => ({
        value: actor.id,
        label: actor.full_name_ar ?? actor.full_name_en ?? actor.email ?? actor.id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      data: {
        actions: AUDIT_ACTION_CODES.map((code) => ({ value: code, label: code })),
        entityTypes,
        actors,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to load audit filters." };
  }
}

export function auditToCsv(data: AuditPageData): string {
  const header = [
    "created_at",
    "action",
    "entity_type",
    "entity_id",
    "actor",
    "old_values",
    "new_values",
    "metadata",
  ];
  const escapeCsv = (value: string | null | undefined): string => {
    const raw = value ?? "";
    return `"${raw.replace(/"/g, '""')}"`;
  };
  const rows = data.rows.map((row) =>
    [
      escapeCsv(row.createdAt),
      escapeCsv(row.action),
      escapeCsv(row.entityType),
      escapeCsv(row.entityId),
      escapeCsv(row.actorName ?? row.actorEmail ?? row.actorId),
      escapeCsv(row.oldValues === null || row.oldValues === undefined ? "" : JSON.stringify(row.oldValues)),
      escapeCsv(row.newValues === null || row.newValues === undefined ? "" : JSON.stringify(row.newValues)),
      escapeCsv(row.metadata === null || row.metadata === undefined ? "" : JSON.stringify(row.metadata)),
    ].join(","),
  );

  return [header.join(","), ...rows].join("\n");
}

export function buildAuditCsvFilename(): string {
  return `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
}
