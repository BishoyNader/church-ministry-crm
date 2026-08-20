"use server";

import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { getActorStageScope } from "@/features/rbac/utils/stage-scope";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import { getTranslations } from "next-intl/server";
import { checkEntitlementLimit } from "@/features/billing/lib/entitlement-guard";
import { ZodError } from "zod";
import { createEventSchema, updateEventSchema } from "../schemas/events.schema";
import type {
  CreateEventFormValues,
  UpdateEventFormValues,
} from "../schemas/events.schema";
import * as eventsService from "../services/events.service";
import type {
  EventActionResult,
  EventFilters,
  EventPageData,
} from "../types/events.types";

function handleZodError(error: unknown): EventActionResult<never> {
  if (error instanceof ZodError) {
    return {
      success: false,
      message: "Please fix the highlighted fields.",
    };
  }
  return {
    success: false,
    message: "An unexpected validation error occurred.",
  };
}

export async function listEventOptionsAction(
  locale: string,
): Promise<EventActionResult<eventsService.EventOptions>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.EVENTS_READ))) {
    return { success: false, message: "You do not have permission to view events." };
  }

  const { data: profile } = await supabase.from("profiles").select("church_id").eq("id", user.id).single();
  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const result = await eventsService.getEventOptions(supabase, profile.church_id);
  if (result.error) {
    const t = await getTranslations({ locale, namespace: "events" });
    return { success: false, message: t("errors.optionsFailed"), data: undefined };
  }

  return { success: true, data: result.data ?? undefined };
}

export async function listEventsAction(
  filters: EventFilters = {},
  locale: string,
): Promise<EventActionResult<EventPageData>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.EVENTS_READ))) {
    return { success: false, message: "You do not have permission to view events." };
  }

  const { data: profile } = await supabase.from("profiles").select("church_id").eq("id", user.id).single();
  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const { scope, error } = await getActorStageScope(supabase, profile.church_id, user.id);
  if (!scope) {
    return { success: false, message: error ?? "Failed to resolve stage scope." };
  }

  const result = await eventsService.listEvents(
    supabase,
    profile.church_id,
    filters,
    scope.churchWide ? undefined : scope.stageIds,
  );
  if (result.error) {
    const t = await getTranslations({ locale, namespace: "events" });
    return { success: false, message: t("errors.listFailed"), data: undefined };
  }

  return { success: true, data: result.data ?? undefined };
}

export async function createEventAction(
  values: CreateEventFormValues,
  locale: string,
): Promise<EventActionResult<{ id: string }>> {
  try {
    createEventSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.EVENTS_CREATE))) {
    const t = await getTranslations({ locale, namespace: "events" });
    return { success: false, message: t("errors.createDenied") };
  }

  const { data: profile } = await supabase.from("profiles").select("church_id").eq("id", user.id).single();
  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const entitlement = await checkEntitlementLimit(supabase, profile.church_id, "maxActiveEvents");
  if (!entitlement.allowed) {
    const t = await getTranslations({ locale, namespace: "events" });
    return { success: false, message: entitlement.reason };
  }

  const result = await eventsService.createEvent(supabase, {
    service_id: values.service_id,
    stage_id: values.stage_id ?? null,
    title_ar: values.title_ar,
    title_en: values.title_en || null,
    description_ar: values.description_ar || null,
    description_en: values.description_en || null,
    location_ar: values.location_ar || null,
    event_type: values.event_type,
    start_at: values.start_at,
    end_at: values.end_at || null,
    capacity: values.capacity ?? null,
  });

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "events" });
    return { success: false, message: t("errors.createFailed") };
  }

  if (result.data) {
    await writeAuditLog(supabase, "create", "event", result.data.id, undefined, {
      title_ar: values.title_ar,
    });
  }

  return {
    success: true,
    message: "Event created successfully.",
    data: result.data ?? undefined,
  };
}

export async function updateEventAction(
  eventId: string,
  values: UpdateEventFormValues,
  locale: string,
): Promise<EventActionResult> {
  try {
    updateEventSchema.parse(values);
  } catch (error) {
    return handleZodError(error);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.EVENTS_UPDATE))) {
    const t = await getTranslations({ locale, namespace: "events" });
    return { success: false, message: t("errors.updateDenied") };
  }

  const { data: profile } = await supabase.from("profiles").select("church_id").eq("id", user.id).single();
  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const existing = await eventsService.getEventById(supabase, eventId, profile.church_id);
  const oldValues = existing.data
    ? { title_ar: existing.data.title_ar, is_active: existing.data.is_active }
    : undefined;

  const result = await eventsService.updateEvent(supabase, eventId, profile.church_id, {
    service_id: values.service_id,
    stage_id: values.stage_id ?? null,
    title_ar: values.title_ar,
    title_en: values.title_en || null,
    description_ar: values.description_ar || null,
    description_en: values.description_en || null,
    location_ar: values.location_ar || null,
    event_type: values.event_type,
    start_at: values.start_at,
    end_at: values.end_at || null,
    capacity: values.capacity ?? null,
    is_active: values.is_active,
  });

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "events" });
    return { success: false, message: t("errors.updateFailed") };
  }

  await writeAuditLog(supabase, "update", "event", eventId, oldValues, {
    title_ar: values.title_ar,
    is_active: values.is_active,
  });

  return { success: true, message: "Event updated successfully." };
}

export async function deleteEventAction(
  eventId: string,
  locale: string,
): Promise<EventActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.EVENTS_DELETE))) {
    const t = await getTranslations({ locale, namespace: "events" });
    return { success: false, message: t("errors.deleteDenied") };
  }

  const { data: profile } = await supabase.from("profiles").select("church_id").eq("id", user.id).single();
  if (!profile) {
    return { success: false, message: "Profile not found." };
  }

  const existing = await eventsService.getEventById(supabase, eventId, profile.church_id);
  if (!existing.data) {
    const t = await getTranslations({ locale, namespace: "events" });
    return { success: false, message: t("errors.notFound") };
  }

  const result = await eventsService.deleteEvent(supabase, eventId, profile.church_id);

  if (result.error) {
    const t = await getTranslations({ locale, namespace: "events" });
    return { success: false, message: t("errors.deleteFailed") };
  }

  await writeAuditLog(supabase, "delete", "event", eventId, {
    title_ar: existing.data.title_ar,
  });

  return { success: true, message: "Event deleted successfully." };
}
