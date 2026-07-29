export type DashboardKPIs = {
  totalActiveChildren: number;
  newChildrenThisMonth: number;
  openFollowups: number;
  completedFollowupsThisMonth: number;
  attendanceThisMonth: number;
  activeStages: number;
};

export type AttendanceTrendItem = {
  period: string;
  present: number;
  absent: number;
  excused: number;
  total: number;
};

export type AttendanceByStageItem = {
  stageId: string;
  stageNameAr: string;
  stageNameEn: string | null;
  present: number;
  absent: number;
  excused: number;
  total: number;
  percentage: number;
};

export type FollowupStatusCount = {
  status: string;
  count: number;
};

export type FollowupAnalytics = {
  statusCounts: FollowupStatusCount[];
  overdue: number;
};

export type PipelineStageCount = {
  stage: string;
  count: number;
};

export type StageAnalyticsItem = {
  stageId: string;
  stageNameAr: string;
  stageNameEn: string | null;
  totalChildren: number;
  attendanceCount: number;
  attendancePercentage: number;
  followupCount: number;
};

export type DashboardData = {
  kpis: DashboardKPIs;
  attendanceWeeklyTrend: AttendanceTrendItem[];
  attendanceMonthlyTrend: AttendanceTrendItem[];
  attendanceByStage: AttendanceByStageItem[];
  followupAnalytics: FollowupAnalytics;
  pipelineAnalytics: PipelineStageCount[];
  stageAnalytics: StageAnalyticsItem[];
};
