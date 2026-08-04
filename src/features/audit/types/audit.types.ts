export type AuditLogEntry = {
  id: string;
  churchId: string | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues: unknown;
  newValues: unknown;
  metadata: unknown;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
};

export type AuditFilters = {
  page?: number;
  pageSize?: number;
  fromDate?: string;
  toDate?: string;
  action?: string;
  entityType?: string;
  actorId?: string;
  search?: string;
};

export type AuditFilterOption = {
  value: string;
  label: string;
};

export type AuditFilterOptions = {
  actions: AuditFilterOption[];
  entityTypes: AuditFilterOption[];
  actors: AuditFilterOption[];
};

export type AuditPageData = {
  rows: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AuditActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};
