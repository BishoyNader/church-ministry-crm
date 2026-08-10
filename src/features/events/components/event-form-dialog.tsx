"use client";

import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import {
  createEventSchema,
  updateEventSchema,
} from "../schemas/events.schema";
import type {
  CreateEventFormValues,
  UpdateEventFormValues,
} from "../schemas/events.schema";
import { useCreateEvent, useUpdateEvent, useEventOptions } from "../hooks/use-events";
import type { EventListItem, EventType } from "../types/events.types";

const EVENT_TYPES: EventType[] = ["meeting", "camp", "conference", "trip", "other"];

function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

type EventFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: EventListItem | null;
  presetServiceId?: string;
};

export function EventFormDialog({
  open,
  onOpenChange,
  event,
  presetServiceId,
}: EventFormDialogProps) {
  const t = useTranslations("events.form");
  const isEdit = !!event;

  const createMutation = useCreateEvent();
  const updateMutation = useUpdateEvent();
  const optionsQuery = useEventOptions();
  const services = useMemo(() => optionsQuery.data?.data?.services ?? [], [optionsQuery.data]);
  const stages = useMemo(() => optionsQuery.data?.data?.stages ?? [], [optionsQuery.data]);

  const createForm = useForm<CreateEventFormValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      title_ar: "",
      title_en: "",
      description_ar: "",
      description_en: "",
      location_ar: "",
      event_type: "meeting",
      service_id: presetServiceId ?? "",
      stage_id: "",
      start_at: "",
      end_at: "",
      capacity: undefined,
    },
  });

  const updateForm = useForm<UpdateEventFormValues>({
    resolver: zodResolver(updateEventSchema),
    defaultValues: {
      title_ar: "",
      title_en: "",
      description_ar: "",
      description_en: "",
      location_ar: "",
      event_type: "meeting",
      service_id: "",
      stage_id: "",
      start_at: "",
      end_at: "",
      capacity: undefined,
      is_active: true,
    },
  });

  useEffect(() => {
    if (isEdit && event) {
      updateForm.reset({
        title_ar: event.title_ar,
        title_en: event.title_en ?? "",
        description_ar: event.description_ar ?? "",
        description_en: event.description_en ?? "",
        location_ar: event.location_ar ?? "",
        event_type: event.event_type,
        service_id: event.service_id,
        stage_id: event.stage_id ?? "",
        start_at: toDatetimeLocal(event.start_at),
        end_at: event.end_at ? toDatetimeLocal(event.end_at) : "",
        capacity: event.capacity ?? undefined,
        is_active: event.is_active,
      });
    }
  }, [isEdit, event, updateForm]);

  const updateIsActive = useWatch({
    control: updateForm.control,
    name: "is_active",
  });

  const createEventType = useWatch({
    control: createForm.control,
    name: "event_type",
  });

  const updateEventType = useWatch({
    control: updateForm.control,
    name: "event_type",
  });

  const createStageId = useWatch({
    control: createForm.control,
    name: "stage_id",
  });

  const updateStageId = useWatch({
    control: updateForm.control,
    name: "stage_id",
  });

  const createServiceId = useWatch({
    control: createForm.control,
    name: "service_id",
  });

  const updateServiceId = useWatch({
    control: updateForm.control,
    name: "service_id",
  });

  const createStagesForService = useMemo(
    () => stages.filter((stage) => stage.service_id === createServiceId),
    [stages, createServiceId],
  );

  const updateStagesForService = useMemo(
    () => stages.filter((stage) => stage.service_id === updateServiceId),
    [stages, updateServiceId],
  );

  const handleCreate = async (values: CreateEventFormValues) => {
    const result = await createMutation.mutateAsync({
      ...values,
      stage_id: values.stage_id || null,
      start_at: fromDatetimeLocal(values.start_at),
      end_at: values.end_at ? fromDatetimeLocal(values.end_at) : null,
      capacity: values.capacity ?? null,
    });
    if (result.success) onOpenChange(false);
  };

  const handleUpdate = async (values: UpdateEventFormValues) => {
    if (!event) return;
    const result = await updateMutation.mutateAsync({
      eventId: event.id,
      values: {
        ...values,
        stage_id: values.stage_id || null,
        start_at: fromDatetimeLocal(values.start_at),
        end_at: values.end_at ? fromDatetimeLocal(values.end_at) : null,
        capacity: values.capacity ?? null,
      },
    });
    if (result.success) onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const formError = createMutation.data?.message || updateMutation.data?.message;

  const renderServiceSelect = (value: string, onChange: (value: unknown) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t("selectService")} />
      </SelectTrigger>
      <SelectContent>
        {services.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">
            {t("noServices")}
          </p>
        ) : (
          services.map((service) => (
            <SelectItem key={service.id} value={service.id}>
              {service.name_en
                ? `${service.name_ar} — ${service.name_en}`
                : service.name_ar}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );

  const renderStageSelect = (value: string, onChange: (value: unknown) => void, serviceId: string, stageOptions: typeof stages) => (
    <Select value={value} onValueChange={onChange} disabled={!serviceId}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t("selectStage")} />
      </SelectTrigger>
      <SelectContent>
        {stageOptions.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">
            {t("noStages")}
          </p>
        ) : (
          stageOptions.map((stage) => (
            <SelectItem key={stage.id} value={stage.id}>
              {stage.name_ar}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );

  const renderEventTypeSelect = (value: EventType, onChange: (value: unknown) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {EVENT_TYPES.map((type) => (
          <SelectItem key={type} value={type}>
            {t(`eventTypes.${type}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editTitle") : t("createTitle")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {isEdit ? (
          <form
            onSubmit={updateForm.handleSubmit(handleUpdate)}
            className="space-y-4"
          >
            <FormField
              label={t("titleAr")}
              error={updateForm.formState.errors.title_ar?.message}
              required
            >
              <Input {...updateForm.register("title_ar")} />
            </FormField>

            <FormField label={t("titleEn")}>
              <Input {...updateForm.register("title_en")} />
            </FormField>

            <FormField
              label={t("eventType")}
              error={updateForm.formState.errors.event_type?.message}
              required
            >
              {renderEventTypeSelect(
                updateEventType,
                (value) => updateForm.setValue("event_type", value as EventType),
              )}
            </FormField>

            <FormField
              label={t("service")}
              error={updateForm.formState.errors.service_id?.message}
              required
            >
              {renderServiceSelect(
                updateServiceId,
                (value) => updateForm.setValue("service_id", value as string),
              )}
            </FormField>

            <FormField label={t("stage")}>
              {renderStageSelect(
                updateStageId ?? "",
                (value) => updateForm.setValue("stage_id", value as string),
                updateServiceId,
                updateStagesForService,
              )}
            </FormField>

            <FormField label={t("locationAr")}>
              <Input {...updateForm.register("location_ar")} />
            </FormField>

            <FormField label={t("descriptionAr")}>
              <Textarea {...updateForm.register("description_ar")} />
            </FormField>

            <FormField label={t("descriptionEn")}>
              <Textarea {...updateForm.register("description_en")} />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label={t("startAt")}
                error={updateForm.formState.errors.start_at?.message}
                required
              >
                <Input
                  type="datetime-local"
                  {...updateForm.register("start_at")}
                />
              </FormField>

              <FormField label={t("endAt")}>
                <Input
                  type="datetime-local"
                  {...updateForm.register("end_at")}
                />
              </FormField>
            </div>

            <FormField
              label={t("capacity")}
              error={updateForm.formState.errors.capacity?.message}
            >
              <Input
                type="number"
                min={0}
                {...updateForm.register("capacity", { valueAsNumber: true })}
              />
            </FormField>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={updateIsActive}
                onCheckedChange={(checked) =>
                  updateForm.setValue("is_active", checked === true)
                }
              />
              {t("isActive")}
            </label>

            {formError && (
              <p className="text-xs text-destructive">{formError}</p>
            )}

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                {t("cancel")}
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? t("processing") : t("save")}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form
            onSubmit={createForm.handleSubmit(handleCreate)}
            className="space-y-4"
          >
            <FormField
              label={t("titleAr")}
              error={createForm.formState.errors.title_ar?.message}
              required
            >
              <Input {...createForm.register("title_ar")} />
            </FormField>

            <FormField label={t("titleEn")}>
              <Input {...createForm.register("title_en")} />
            </FormField>

            <FormField
              label={t("eventType")}
              error={createForm.formState.errors.event_type?.message}
              required
            >
              {renderEventTypeSelect(
                createEventType,
                (value) => createForm.setValue("event_type", value as EventType),
              )}
            </FormField>

            <FormField
              label={t("service")}
              error={createForm.formState.errors.service_id?.message}
              required
            >
              {renderServiceSelect(
                createServiceId,
                (value) => createForm.setValue("service_id", value as string),
              )}
            </FormField>

            <FormField label={t("stage")}>
              {renderStageSelect(
                createStageId ?? "",
                (value) => createForm.setValue("stage_id", value as string),
                createServiceId,
                createStagesForService,
              )}
            </FormField>

            <FormField label={t("locationAr")}>
              <Input {...createForm.register("location_ar")} />
            </FormField>

            <FormField label={t("descriptionAr")}>
              <Textarea {...createForm.register("description_ar")} />
            </FormField>

            <FormField label={t("descriptionEn")}>
              <Textarea {...createForm.register("description_en")} />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label={t("startAt")}
                error={createForm.formState.errors.start_at?.message}
                required
              >
                <Input
                  type="datetime-local"
                  {...createForm.register("start_at")}
                />
              </FormField>

              <FormField label={t("endAt")}>
                <Input
                  type="datetime-local"
                  {...createForm.register("end_at")}
                />
              </FormField>
            </div>

            <FormField
              label={t("capacity")}
              error={createForm.formState.errors.capacity?.message}
            >
              <Input
                type="number"
                min={0}
                {...createForm.register("capacity", { valueAsNumber: true })}
              />
            </FormField>

            {formError && (
              <p className="text-xs text-destructive">{formError}</p>
            )}

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                {t("cancel")}
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? t("processing") : t("save")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogPopup>
    </Dialog>
  );
}
