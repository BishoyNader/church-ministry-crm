"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProfileSettingsAction,
  updateProfileAction,
  getChurchSettingsAction,
  updateChurchAction,
  changePasswordAction,
} from "../actions/settings.actions";
import type {
  UpdateProfileFormValues,
  UpdateChurchFormValues,
  ChangePasswordFormValues,
} from "../schemas/settings.schema";

export const SETTINGS_QUERY_KEYS = {
  all: ["settings"] as const,
  profile: ["settings", "profile"] as const,
  church: ["settings", "church"] as const,
};

export function useProfileSettings() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEYS.profile,
    queryFn: async () => {
      const result = await getProfileSettingsAction();
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load profile settings.");
      }
      return result;
    },
    staleTime: 30_000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: UpdateProfileFormValues) => updateProfileAction(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all }),
  });
}

export function useChurchSettings(enabled = true) {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEYS.church,
    queryFn: async () => {
      const result = await getChurchSettingsAction();
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load church settings.");
      }
      return result;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useUpdateChurch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: UpdateChurchFormValues) => updateChurchAction(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (values: ChangePasswordFormValues) => changePasswordAction(values),
  });
}