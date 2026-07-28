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
} from "../actions/user.actions";
import type { CreateUserFormValues, UpdateUserFormValues } from "../schemas/user.schema";

export const USER_QUERY_KEYS = {
  all: ["users"] as const,
  list: (params: { page: number; pageSize: number; search?: string; roleFilter?: string }) =>
    ["users", "list", params] as const,
  detail: (id: string) => ["users", "detail", id] as const,
  roles: (churchId: string) => ["users", "roles", churchId] as const,
  stages: (churchId: string) => ["users", "stages", churchId] as const,
};

export function useUserList(params: {
  page: number;
  pageSize: number;
  search?: string;
  roleFilter?: string;
}) {
  return useQuery({
    queryKey: USER_QUERY_KEYS.list(params),
    queryFn: () =>
      listUsersAction(params.page, params.pageSize, params.search, params.roleFilter),
    staleTime: 30_000,
  });
}

export function useUserDetail(userId: string | null) {
  return useQuery({
    queryKey: USER_QUERY_KEYS.detail(userId ?? ""),
    queryFn: () => getUserAction(userId!),
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
    mutationFn: ({ userId, values }: { userId: string; values: UpdateUserFormValues }) =>
      updateUserAction(userId, values),
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
    mutationFn: (userId: string) => deactivateUserAction(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.all });
    },
  });
}

export function useAssignRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) =>
      assignRolesAction(userId, roleIds),
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
    mutationFn: ({ userId, stageIds }: { userId: string; stageIds: string[] }) =>
      assignStagesAction(userId, stageIds),
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
    queryFn: () => getRolesAction(churchId!),
    enabled: !!churchId,
    staleTime: 60_000,
  });
}

export function useStages(churchId: string | null) {
  return useQuery({
    queryKey: USER_QUERY_KEYS.stages(churchId ?? ""),
    queryFn: () => getStagesAction(churchId!),
    enabled: !!churchId,
    staleTime: 60_000,
  });
}
