"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listUsersAction,
  getUserAction,
  createUserAction,
  updateUserAction,
  deactivateUserAction,
  assignRolesAction,
  assignStagesAction,
  getRolesAction,
  getStagesAction,
  getActorChurchAction,
  exportUsersAction,
} from "../actions/user.actions";
import type { CreateUserFormValues, UpdateUserFormValues } from "../schemas/user.schema";

export const USER_QUERY_KEYS = {
  all: ["users"] as const,
  actorChurch: ["users", "actor-church"] as const,
  list: (params: {
    page: number;
    pageSize: number;
    search?: string;
    roleFilter?: string;
    churchId?: string;
  }) => ["users", "list", params] as const,
  detail: (id: string) => ["users", "detail", id] as const,
  roles: (churchId: string) => ["users", "roles", churchId] as const,
  stages: (churchId: string) => ["users", "stages", churchId] as const,
};

export function useActorChurch() {
  return useQuery({
    queryKey: USER_QUERY_KEYS.actorChurch,
    queryFn: async () => {
      const result = await getActorChurchAction();
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load church context.");
      }
      return result.data ?? { churchId: null, isPlatformOwner: false };
    },
    staleTime: 60_000,
  });
}

export function useUserList(params: {
  page: number;
  pageSize: number;
  search?: string;
  roleFilter?: string;
  churchId?: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: USER_QUERY_KEYS.list(params),
    queryFn: async () => {
      const result = await listUsersAction(
        params.page,
        params.pageSize,
        params.search,
        params.roleFilter,
        params.churchId,
      );
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load users.");
      }
      return result;
    },
    enabled: params.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useUserDetail(userId: string | null, churchId?: string) {
  return useQuery({
    queryKey: USER_QUERY_KEYS.detail(userId ?? ""),
    queryFn: async () => {
      const result = await getUserAction(userId!, churchId);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load user.");
      }
      return result;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CreateUserFormValues) => createUserAction(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.all });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      values,
      churchId,
    }: {
      userId: string;
      values: UpdateUserFormValues;
      churchId?: string;
    }) => updateUserAction(userId, values, churchId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.all });
      queryClient.invalidateQueries({
        queryKey: USER_QUERY_KEYS.detail(variables.userId),
      });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, churchId }: { userId: string; churchId?: string }) =>
      deactivateUserAction(userId, churchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.all });
    },
  });
}

export function useAssignRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      roleIds,
      churchId,
    }: {
      userId: string;
      roleIds: string[];
      churchId?: string;
    }) => assignRolesAction(userId, roleIds, churchId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.all });
      queryClient.invalidateQueries({
        queryKey: USER_QUERY_KEYS.detail(variables.userId),
      });
    },
  });
}

export function useAssignStages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      stageIds,
      churchId,
    }: {
      userId: string;
      stageIds: string[];
      churchId?: string;
    }) => assignStagesAction(userId, stageIds, churchId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.all });
      queryClient.invalidateQueries({
        queryKey: USER_QUERY_KEYS.detail(variables.userId),
      });
    },
  });
}

export function useRoles(churchId: string | null) {
  return useQuery({
    queryKey: USER_QUERY_KEYS.roles(churchId ?? ""),
    queryFn: async () => {
      const result = await getRolesAction(churchId!);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load roles.");
      }
      return result;
    },
    enabled: !!churchId,
    staleTime: 60_000,
  });
}

export function useExportUsers() {
  return useMutation({
    mutationFn: (values: {
      format: "csv" | "xlsx";
      search?: string;
      roleFilter?: string;
      churchId?: string;
    }) => exportUsersAction(values),
  });
}

export function useStages(churchId: string | null) {
  return useQuery({
    queryKey: USER_QUERY_KEYS.stages(churchId ?? ""),
    queryFn: async () => {
      const result = await getStagesAction(churchId!);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load stages.");
      }
      return result;
    },
    enabled: !!churchId,
    staleTime: 60_000,
  });
}
