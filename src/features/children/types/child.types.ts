import type { Database } from "@/types/database.types";

export type ChildRow = Database["public"]["Tables"]["children"]["Row"];
export type ChildInsert = Database["public"]["Tables"]["children"]["Insert"];
export type ChildUpdate = Database["public"]["Tables"]["children"]["Update"];

export type AttendanceRow = Database["public"]["Tables"]["attendance"]["Row"];
export type AttendanceInsert = Database["public"]["Tables"]["attendance"]["Insert"];
export type AttendanceUpdate = Database["public"]["Tables"]["attendance"]["Update"];

export type FollowupRow = Database["public"]["Tables"]["followups"]["Row"];
export type FollowupInsert = Database["public"]["Tables"]["followups"]["Insert"];
export type FollowupUpdate = Database["public"]["Tables"]["followups"]["Update"];

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type MinistryRow = Database["public"]["Tables"]["ministries"]["Row"];
export type StageRow = Database["public"]["Tables"]["stages"]["Row"];

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
  ministryNameAr: string;
  stageNameAr: string;
};

export type ChildDetailFollowup = FollowupRow & {
  profiles?: { full_name_ar: string | null } | null;
};

export type ChildDetail = ChildRow & {
  ministryNameAr: string;
  stageNameAr: string;
  attendance: AttendanceRow[];
  followups: ChildDetailFollowup[];
};

export type AttendanceListItem = AttendanceRow & {
  childFirstNameAr: string;
  childLastNameAr: string;
  stageNameAr: string;
};

export type FollowupListItem = FollowupRow & {
  childFirstNameAr: string;
  childLastNameAr: string;
  stageNameAr: string;
  assignedToNameAr: string | null;
};

export type CreateChildInput = {
  first_name_ar: string;
  first_name_en?: string;
  last_name_ar: string;
  last_name_en?: string;
  date_of_birth?: string;
  gender?: "male" | "female";
  ministry_id: string;
  stage_id: string;
  pipeline_stage?: "new_visitor" | "first_followup" | "regular_attendee" | "active_member" | "leader_candidate";
  parent_phone?: string;
  parent_email?: string;
  parent_address_ar?: string;
  father_name_ar?: string;
  mother_name_ar?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  mobile?: string;
  allergies?: string;
  medical_conditions?: string;
  medications?: string;
  baptism_date?: string;
  confession_frequency?: string;
  spiritual_notes?: string;
  school_name_ar?: string;
  grade_level?: string;
  notes?: string;
  photo_url?: string;
};

export type UpdateChildInput = {
  first_name_ar: string;
  first_name_en?: string;
  last_name_ar: string;
  last_name_en?: string;
  date_of_birth?: string;
  gender?: "male" | "female";
  ministry_id: string;
  stage_id: string;
  pipeline_stage: "new_visitor" | "first_followup" | "regular_attendee" | "active_member" | "leader_candidate";
  status: "active" | "inactive" | "transferred" | "graduated";
  parent_phone?: string;
  parent_email?: string;
  parent_address_ar?: string;
  father_name_ar?: string;
  mother_name_ar?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  mobile?: string;
  allergies?: string;
  medical_conditions?: string;
  medications?: string;
  baptism_date?: string;
  confession_frequency?: string;
  spiritual_notes?: string;
  school_name_ar?: string;
  grade_level?: string;
  notes?: string;
  photo_url?: string;
};

export type TransferChildInput = {
  ministry_id: string;
  stage_id: string;
};

export type CreateAttendanceInput = {
  child_id: string;
  stage_id: string;
  attendance_date: string;
  status: "present" | "absent" | "excused";
  notes?: string;
};

export type BatchAttendanceInput = {
  stage_id: string;
  attendance_date: string;
  records: {
    child_id: string;
    status: "present" | "absent" | "excused";
    notes?: string;
  }[];
};

export type CreateFollowupInput = {
  child_id: string;
  stage_id: string;
  type: "phone_call" | "home_visit" | "whatsapp" | "church_meeting" | "other";
  scheduled_at?: string;
  assigned_to?: string;
  notes?: string;
};

export type UpdateFollowupInput = {
  status?: "scheduled" | "in_progress" | "completed" | "cancelled";
  outcome?: string;
  notes?: string;
  assigned_to?: string;
  scheduled_at?: string;
};
