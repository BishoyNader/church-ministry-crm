export type ServantAttendanceStatus = "present" | "absent" | "excused";

export type ServantAttendanceAttendee = {
  id: string;
  full_name_ar: string;
  full_name_en: string | null;
  email: string | null;
  avatar_url: string | null;
  roleNameAr?: string | null;
};

export type ServantAttendanceRecordValue = {
  status: ServantAttendanceStatus;
  notes: string;
};

export type ServantAttendanceData = {
  attendees: ServantAttendanceAttendee[];
  records: Record<string, ServantAttendanceRecordValue>;
};

export type ServantAttendanceHistoryItem = {
  sessionId: string;
  sessionDate: string;
  total: number;
  present: number;
  absent: number;
  excused: number;
};
