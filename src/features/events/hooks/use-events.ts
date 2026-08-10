"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  createEventAction,
  deleteEventAction,
  listEventOptionsAction,
  listEventsAction,
  updateEventAction,
} from "../actions/events.actions";
import type {
  CreateEventFormValues,
  UpdateEventFormValues,
} from "../schemas/events.schema";
import type { EventFilters } from "../types/events.types";

export const EVENTS_QUERY_KEYS = {
  all: ["events"] as const,
  list: (filters: EventFilters) => ["events", "list", filters] as const,
  options: () => ["events", "options"] as const,
};

export function useEventOptions() {
  const locale = useLocale();
  return useQuery({
    queryKey: EVENTS_QUERY_KEYS.options(),
    queryFn: async () => {
      const result = await listEventOptionsAction(locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load event options.");
      }
      return result;
    },
    staleTime: 60_000,
  });
}

export function useEventList(filters: EventFilters = {}) {
  const locale = useLocale();
  return useQuery({
    queryKey: EVENTS_QUERY_KEYS.list(filters),
    queryFn: async () => {
      const result = await listEventsAction(filters, locale);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load events.");
      }
      return result;
    },
    staleTime: 30_000,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: (values: CreateEventFormValues) => createEventAction(values, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEYS.all });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: ({
      eventId,
      values,
    }: {
      eventId: string;
      values: UpdateEventFormValues;
    }) => updateEventAction(eventId, values, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEYS.all });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useMutation({
    mutationFn: (eventId: string) => deleteEventAction(eventId, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEYS.all });
    },
  });
}
