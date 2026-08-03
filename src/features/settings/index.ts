export type {
  ProfileSettings,
  ChurchSettings,
  UpdateProfileInput,
  UpdateChurchInput,
  ChangePasswordInput,
} from "./types/settings.types";

export {
  updateProfileSchema,
  updateChurchSchema,
  changePasswordSchema,
} from "./schemas/settings.schema";
export type {
  UpdateProfileFormValues,
  UpdateChurchFormValues,
  ChangePasswordFormValues,
} from "./schemas/settings.schema";

export {
  getProfileSettingsAction,
  updateProfileAction,
  getChurchSettingsAction,
  updateChurchAction,
  changePasswordAction,
} from "./actions/settings.actions";

export {
  useProfileSettings,
  useUpdateProfile,
  useChurchSettings,
  useUpdateChurch,
  useChangePassword,
  SETTINGS_QUERY_KEYS,
} from "./hooks/use-settings";

export { SettingsPage } from "./components/settings-page";
export { ProfileSettingsCard } from "./components/profile-settings-card";
export { ChurchSettingsCard } from "./components/church-settings-card";
export { ChangePasswordCard } from "./components/change-password-card";