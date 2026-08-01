export type {
  ChildListItem,
  ChildDetail,
  AttendanceListItem,
  FollowupListItem,
  CreateChildInput,
  UpdateChildInput,
  TransferChildInput,
  CreateAttendanceInput,
  BatchAttendanceInput,
  CreateFollowupInput,
  UpdateFollowupInput,
  PaginationInput,
  PaginatedResult,
} from "./types/child.types";

export {
  createChildSchema,
  updateChildSchema,
  transferChildSchema,
  createAttendanceSchema,
  batchAttendanceSchema,
  createFollowupSchema,
  updateFollowupSchema,
  paginationSchema,
  uuidParamSchema,
} from "./schemas/child.schema";
export type {
  CreateChildFormValues,
  UpdateChildFormValues,
  TransferChildFormValues,
  CreateAttendanceFormValues,
  BatchAttendanceFormValues,
  CreateFollowupFormValues,
  UpdateFollowupFormValues,
} from "./schemas/child.schema";

export {
  listChildrenAction,
  getChildByIdAction,
  createChildAction,
  updateChildAction,
  transferChildAction,
  deactivateChildAction,
  createAttendanceAction,
  batchAttendanceAction,
  listAttendanceAction,
  createFollowupAction,
  updateFollowupAction,
  listFollowupsAction,
  listStagesAction,
  listServicesAction,
  listUsersAction,
} from "./actions/child.actions";

export {
  useChildList,
  useChildDetail,
  useCreateChild,
  useUpdateChild,
  useTransferChild,
  useDeactivateChild,
  useChildStages,
  useChildServices,
  CHILD_QUERY_KEYS,
} from "./hooks/use-children";

export {
  useAttendanceList,
  useCreateAttendance,
  useBatchAttendance,
  ATTENDANCE_QUERY_KEYS,
} from "./hooks/use-attendance";

export {
  useFollowupList,
  useCreateFollowup,
  useUpdateFollowup,
  FOLLOWUP_QUERY_KEYS,
} from "./hooks/use-followups";

export { ChildListPage } from "./components/child-list-page";
export { ChildDetailPage } from "./components/child-detail-page";
export { ChildEmptyState } from "./components/child-empty-state";
export { ChildTable } from "./components/child-table";
export { ChildFormDialog } from "./components/child-form-dialog";
export { ChildDeleteDialog } from "./components/child-delete-dialog";
export { ChildDetailTabs } from "./components/child-detail-tabs";
export { AttendancePage } from "./components/attendance-page";
export { AttendanceTable } from "./components/attendance-table";
export type { AttendanceRecord } from "./components/attendance-table";
export { FollowupListPage } from "./components/followup-list-page";
export { FollowupFormDialog } from "./components/followup-form-dialog";
export { FollowupStatusDialog } from "./components/followup-status-dialog";
