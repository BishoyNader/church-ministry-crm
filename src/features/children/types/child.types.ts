import type { Database } from "@/types/database.types";

export type ChildRow = Database["public"]["Tables"]["beneficiaries"]["Row"];
export type ChildInsert = Database["public"]["Tables"]["beneficiaries"]["Insert"];
export type ChildUpdate = Database["public"]["Tables"]["beneficiaries"]["Update"];

export type AttendanceSessionRow = Database["public"]["Tables"]["attendance_sessions"]["Row"];
export type AttendanceRecordRow = Database["public"]["Tables"]["attendance_records"]["Row"];
export type AttendanceRecordInsert = Database["public"]["Tables"]["attendance_records"]["Insert"];

export type FollowupRow = Database["public"]["Tables"]["followups"]["Row"];
export type FollowupInsert = Database["public"]["Tables"]["followups"]["Insert"];
export type FollowupUpdate = Database["public"]["Tables"]["followups"]["Update"];

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type MinistryRow = Database["public"]["Tables"]["services"]["Row"];
export type StageRow = Database["public"]["Tables"]["stages"]["Row"];

export type ChildAssignmentName = {
  service_id: string;
  stage_id: string;
  services?: Pick<MinistryRow, "name_ar"> | null;
  stages?: Pick<StageRow, "name_ar"> | null;
};

export type ChildRowWithNames = ChildRow & {
  beneficiary_assignments?: ChildAssignmentName[] | null;
};

export type AttendanceRecordWithSession = AttendanceRecordRow & {
  attendance_sessions?: Pick<AttendanceSessionRow, "session_date"> | null;
};

// ─── Pagination ──────────────────────────────────────────────

export type PaginationInput = {
  page?: number;
  pageSize?: number;
};

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ChildListItem = ChildRow & {
  serviceId: string;
  stageId: string;
  serviceNameAr: string;
  stageNameAr: string;
};

export type ChildDetailFollowup = FollowupRow & {
  servants?: { profiles?: { full_name_ar: string | null } | null } | null;
};

export type ChildDetail = ChildRow & {
  serviceId: string;
  stageId: string;
  serviceNameAr: string;
  stageNameAr: string;
  attendance: AttendanceRecordRow[];
  followups: ChildDetailFollowup[];
};

export type AttendanceListItem = AttendanceRecordRow & {
  childFullNameAr: string;
  stageNameAr: string;
};

export type FollowupListItem = FollowupRow & {
  childFullNameAr: string;
  stageNameAr: string;
  assignedToNameAr: string | null;
};

export type CreateChildInput = {
  full_name_ar: string;
  full_name_en?: string;
  date_of_birth?: string;
  gender?: "male" | "female";
  service_id: string;
  stage_id: string;
  father_mobile?: string;
  mother_mobile?: string;
  mobile?: string;
  whatsapp?: string;
  address?: string;
  school?: string;
  confession_father?: string;
  notes?: string;
  photo_url?: string;
};

export type UpdateChildInput = {
  full_name_ar: string;
  full_name_en?: string;
  date_of_birth?: string;
  gender?: "male" | "female";
  service_id: string;
  stage_id: string;
  status: string;
  father_mobile?: string;
  mother_mobile?: string;
  mobile?: string;
  whatsapp?: string;
  address?: string;
  school?: string;
  confession_father?: string;
  notes?: string;
  photo_url?: string;
};

export type TransferChildInput = {
  service_id: string;
  stage_id: string;
};

export type CreateAttendanceInput = {
  beneficiary_id: string;
  stage_id: string;
  service_id: string;
  attendance_date: string;
  status: "present" | "absent" | "excused";
  notes?: string;
};

export type BatchAttendanceInput = {
  stage_id: string;
  service_id: string;
  attendance_date: string;
  records: {
    beneficiary_id: string;
    status: "present" | "absent" | "excused";
    notes?: string;
  }[];
};

export type CreateFollowupInput = {
  beneficiary_id: string;
  type: "phone_call" | "home_visit" | "whatsapp" | "church_meeting" | "other";
  scheduled_at?: string;
  assigned_to?: string;
  notes?: string;
};

export type UpdateFollowupInput = {
  status?: "open" | "in_progress" | "completed" | "cancelled";
  outcome?: string;
  notes?: string;
  assigned_to?: string;
  scheduled_at?: string;
};
