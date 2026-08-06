"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  previewUsersImportAction,
  importUsersAction,
  exportUsersTemplateAction,
} from "../actions/user-import.actions";
import type {
  PreviewUsersImportFormValues,
  ImportUsersFormValues,
} from "../schemas/user-import.schema";
import type { UserImportFileFormat } from "../types/user-import.types";
import { USER_QUERY_KEYS } from "./use-users";

export function usePreviewUsersImport() {
  return useMutation({
    mutationFn: (values: PreviewUsersImportFormValues) =>
      previewUsersImportAction(values),
  });
}

export function useImportUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: ImportUsersFormValues) => importUsersAction(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.all });
    },
  });
}

export function useExportUsersTemplate() {
  return useMutation({
    mutationFn: (format: UserImportFileFormat) =>
      exportUsersTemplateAction(format),
  });
}
