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
