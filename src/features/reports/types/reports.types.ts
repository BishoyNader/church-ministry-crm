export type ReportsFilters = {
  fromDate?: string;
  toDate?: string;
  serviceId?: string;
  stageId?: string;
  servantId?: string;
};

export type ReportsFilterOption = {
  id: string;
  label: string;
};

export type AttendanceRateSummary = {
  present: number;
  absent: number;
  excused: number;
  total: number;
  rate: number;
};

export type ServantAttendanceRow = {
  servantId: string;
  servantName: string;
  present: number;
  absent: number;
  excused: number;
  total: number;
  rate: number;
};

export type BeneficiaryAttendanceRow = {
  beneficiaryId: string;
  beneficiaryName: string;
  present: number;
  absent: number;
  excused: number;
  total: number;
  rate: number;
};

export type FollowupCompletionRow = {
  completed: number;
  open: number;
  overdue: number;
  total: number;
  completionRate: number;
};

export type StageComparisonRow = {
  stageId: string;
  stageName: string;
  present: number;
  absent: number;
  excused: number;
  total: number;
  attendanceRate: number;
  followupCount: number;
  beneficiaryCount: number;
};

export type TrendRow = {
  period: string;
  present: number;
  absent: number;
  excused: number;
  total: number;
};

export type DailyAttendanceRecord = {
  beneficiaryId: string;
  beneficiaryName: string;
  serviceName: string;
  stageName: string;
  status: "present" | "absent" | "excused";
  recordedByName: string | null;
  recordedAt: string;
};

/**
 * One attendance day: totals across every session of that date (scoped by the
 * active filters), plus the drill-in record list. Because the DB enforces one
 * record per attendee per session (048/055), each attendee is counted exactly
 * once per day — repeated status changes never inflate these numbers.
 */
export type DailyAttendanceRow = {
  sessionDate: string;
  total: number;
  present: number;
  absent: number;
  excused: number;
  rate: number;
  records: DailyAttendanceRecord[];
};

export type ReportsData = {
  attendanceRate: AttendanceRateSummary;
  servantAttendance: ServantAttendanceRow[];
  beneficiaryAttendance: BeneficiaryAttendanceRow[];
  followupCompletion: FollowupCompletionRow;
  stageComparison: StageComparisonRow[];
  monthlyTrends: TrendRow[];
  yearlyTrends: TrendRow[];
};

export type ReportsFilterOptions = {
  services: ReportsFilterOption[];
  stages: ReportsFilterOption[];
  servants: ReportsFilterOption[];
};

export type ReportsActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};
