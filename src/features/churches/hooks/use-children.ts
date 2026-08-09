"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { getChurchChildrenAction } from "../actions/church-admin.actions";
import type { ChildListItem, PaginatedResult } from "@/features/children/types/child.types";

export const CHURCH_CHILDREN_QUERY_KEYS = {
  children: (churchId: string, filters: Record<string, unknown>) =>
    ["churches", "children", churchId, filters] as const,
};

export function useChurchChildren(
  churchId: string,
  filters: {
    page?: number;
    pageSize?: number;
    search?: string;
    service_id?: string;
    stage_id?: string;
    status?: string;
  } = {},
) {
  const locale = useLocale();
  return useQuery({
    queryKey: CHURCH_CHILDREN_QUERY_KEYS.children(churchId, filters),
    queryFn: async () => {
      const result = await getChurchChildrenAction(churchId, filters, locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load church children.");
      }
      return result.data as PaginatedResult<ChildListItem>;
    },
    enabled: !!churchId,
    staleTime: 30_000,
  });
}