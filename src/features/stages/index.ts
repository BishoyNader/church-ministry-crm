export type {
  MinistryListItem,
  MinistryDetail,
  StageListItem,
  StageUser,
  CreateMinistryInput,
  UpdateMinistryInput,
  CreateStageInput,
  UpdateStageInput,
} from "./types/stage.types";

export {
  createMinistrySchema,
  updateMinistrySchema,
  createStageSchema,
  updateStageSchema,
} from "./schemas/stage.schema";
export type {
  CreateMinistryFormValues,
  UpdateMinistryFormValues,
  CreateStageFormValues,
  UpdateStageFormValues,
} from "./schemas/stage.schema";

export {
  listMinistries,
  getMinistryById,
  createMinistry,
  updateMinistry,
  deactivateMinistry,
  listStages,
  getStageById,
  createStage,
  updateStage,
  deactivateStage,
  getStageUsers,
  assignUsersToStage,
} from "./services/stage.service";

export {
  listMinistriesAction,
  getMinistryByIdAction,
  createMinistryAction,
  updateMinistryAction,
  deactivateMinistryAction,
  listStagesAction,
  createStageAction,
  updateStageAction,
  deactivateStageAction,
  getStageUsersAction,
  assignUsersToStageAction,
  listAllUsersAction,
} from "./actions/stage.actions";

export {
  useMinistryList,
  useMinistryDetail,
  useCreateMinistry,
  useUpdateMinistry,
  useDeactivateMinistry,
  MINISTRY_QUERY_KEYS,
} from "./hooks/use-ministries";

export {
  useStageList,
  useCreateStage,
  useUpdateStage,
  useDeactivateStage,
  useStageUsers,
  useAssignUsersToStage,
  STAGE_QUERY_KEYS,
} from "./hooks/use-stages";

export { StageManagementPage } from "./components/stage-management-page";
