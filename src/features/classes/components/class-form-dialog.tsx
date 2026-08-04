"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  createClassSchema,
  updateClassSchema,
} from "../schemas/classes.schema";
import type {
  CreateClassFormValues,
  UpdateClassFormValues,
} from "../schemas/classes.schema";
import { useCreateClass, useUpdateClass, useStageOptions } from "../hooks/use-classes";
import type { ClassListItem } from "../types/classes.types";
import { FormField } from "@/components/ui/form-field";

type ClassFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classItem?: ClassListItem | null;
};

export function ClassFormDialog({
  open,
  onOpenChange,
  classItem,
}: ClassFormDialogProps) {
  const t = useTranslations("classes.form");
  const isEdit = !!classItem;

  const createMutation = useCreateClass();
  const updateMutation = useUpdateClass();
  const stagesQuery = useStageOptions();
  const stages = stagesQuery.data?.data ?? [];

  const createForm = useForm<CreateClassFormValues>({
    resolver: zodResolver(createClassSchema),
    defaultValues: {
      stage_id: "",
      name_ar: "",
      name_en: "",
      sort_order: 0,
    },
  });

  const updateForm = useForm<UpdateClassFormValues>({
    resolver: zodResolver(updateClassSchema),
    defaultValues: {
      stage_id: "",
      name_ar: "",
      name_en: "",
      sort_order: 0,
      is_active: true,
    },
  });

  useEffect(() => {
    if (isEdit && classItem) {
      updateForm.reset({
        stage_id: classItem.stage_id,
        name_ar: classItem.name_ar,
        name_en: classItem.name_en ?? "",
        sort_order: classItem.sort_order,
        is_active: classItem.is_active,
      });
    }
  }, [isEdit, classItem, updateForm]);

  const updateIsActive = useWatch({
    control: updateForm.control,
    name: "is_active",
  });

  const createStageId = useWatch({
    control: createForm.control,
    name: "stage_id",
  });

  const updateStageId = useWatch({
    control: updateForm.control,
    name: "stage_id",
  });

  const handleCreate = async (values: CreateClassFormValues) => {
    const result = await createMutation.mutateAsync(values);
    if (result.success) onOpenChange(false);
  };

  const handleUpdate = async (values: UpdateClassFormValues) => {
    if (!classItem) return;
    const result = await updateMutation.mutateAsync({
      classId: classItem.id,
      values,
    });
    if (result.success) onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const formError = createMutation.data?.message || updateMutation.data?.message;

  const renderStageSelect = (
    value: string,
    onChange: (value: unknown) => void,
  ) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t("selectStage")} />
      </SelectTrigger>
      <SelectContent>
        {stages.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">
            {t("noStages")}
          </p>
        ) : (
          stages.map((stage) => (
            <SelectItem key={stage.id} value={stage.id}>
              {stage.service_name_ar
                ? `${stage.name_ar} — ${stage.service_name_ar}`
                : stage.name_ar}
            </SelectItem>
          ))
        )}
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
              label={t("stage")}
              error={updateForm.formState.errors.stage_id?.message}
              required
            >
              {renderStageSelect(
                updateStageId,
                (value) => updateForm.setValue("stage_id", value as string),
              )}
            </FormField>

            <FormField
              label={t("nameAr")}
              error={updateForm.formState.errors.name_ar?.message}
              required
            >
              <Input {...updateForm.register("name_ar")} />
            </FormField>

            <FormField label={t("nameEn")}>
              <Input {...updateForm.register("name_en")} />
            </FormField>

            <FormField
              label={t("sortOrder")}
              error={updateForm.formState.errors.sort_order?.message}
            >
              <Input
                type="number"
                min={0}
                {...updateForm.register("sort_order", { valueAsNumber: true })}
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
              label={t("stage")}
              error={createForm.formState.errors.stage_id?.message}
              required
            >
              {renderStageSelect(
                createStageId,
                (value) => createForm.setValue("stage_id", value as string),
              )}
            </FormField>

            <FormField
              label={t("nameAr")}
              error={createForm.formState.errors.name_ar?.message}
              required
            >
              <Input {...createForm.register("name_ar")} />
            </FormField>

            <FormField label={t("nameEn")}>
              <Input {...createForm.register("name_en")} />
            </FormField>

            <FormField
              label={t("sortOrder")}
              error={createForm.formState.errors.sort_order?.message}
            >
              <Input
                type="number"
                min={0}
                {...createForm.register("sort_order", { valueAsNumber: true })}
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
