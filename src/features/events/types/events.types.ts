import type { Database } from "@/types/database.types";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type EventInsert = Database["public"]["Tables"]["events"]["Insert"];
export type EventUpdate = Database["public"]["Tables"]["events"]["Update"];
export type EventType = Database["public"]["Enums"]["event_type"];

export type EventListItem = EventRow & {
  serviceNameAr: string | null;
  stageNameAr: string | null;
  registrationsCount: number;
};

export type EventTypeFilter = "all" | EventType;

export type EventFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  eventType?: EventTypeFilter;
  serviceId?: string;
};

export type EventPageData = {
  rows: EventListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CreateEventInput = {
  service_id: string;
  stage_id?: string | null;
  title_ar: string;
  title_en?: string | null;
  description_ar?: string | null;
  description_en?: string | null;
  location_ar?: string | null;
  event_type: EventType;
  start_at: string;
  end_at?: string | null;
  capacity?: number | null;
  is_active?: boolean;
};

export type UpdateEventInput = {
  service_id: string;
  stage_id?: string | null;
  title_ar: string;
  title_en?: string | null;
  description_ar?: string | null;
  description_en?: string | null;
  location_ar?: string | null;
  event_type: EventType;
  start_at: string;
  end_at?: string | null;
  capacity?: number | null;
  is_active: boolean;
};

export type EventActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};
