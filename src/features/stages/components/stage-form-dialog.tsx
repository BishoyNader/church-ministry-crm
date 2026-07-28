"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  createStageSchema,
  updateStageSchema,
} from "../schemas/stage.schema";
import type {
  CreateStageFormValues,
  UpdateStageFormValues,
} from "../schemas/stage.schema";
import { useCreateStage, useUpdateStage } from "../hooks/use-stages";
import type { StageListItem } from "../types/stage.types";
import { FormField } from "./form-field";

type StageFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ministryId: string;
  stage?: StageListItem | null;
};

export function StageFormDialog({
  open,
  onOpenChange,
  ministryId,
  stage,
}: StageFormDialogProps) {
  const t = useTranslations("stages.stage.form");
  const isEdit = !!stage;

  const createMutation = useCreateStage();
  const updateMutation = useUpdateStage();

  const createForm = useForm<CreateStageFormValues>({
    resolver: zodResolver(createStageSchema),
    defaultValues: {
      ministry_id: ministryId,
      name_ar: "",
      name_en: "",
      description_ar: "",
      description_en: "",
      age_min: null,
      age_max: null,
      sort_order: 0,
    },
  });

  const updateForm = useForm<UpdateStageFormValues>({
    resolver: zodResolver(updateStageSchema),
    defaultValues: {
      name_ar: "",
      name_en: "",
      description_ar: "",
      description_en: "",
      age_min: null,
      age_max: null,
      sort_order: 0,
      is_active: true,
    },
  });

  useEffect(() => {
    createForm.setValue("ministry_id", ministryId);
  }, [ministryId, createForm]);

  useEffect(() => {
    if (isEdit && stage) {
      updateForm.reset({
        name_ar: stage.name_ar,
        name_en: stage.name_en ?? "",
        description_ar: stage.description_ar ?? "",
        description_en: stage.description_en ?? "",
        age_min: stage.age_min,
        age_max: stage.age_max,
        sort_order: stage.sort_order,
        is_active: stage.is_active,
      });
    }
  }, [isEdit, stage, updateForm]);

  const handleCreate = async (values: CreateStageFormValues) => {
    const result = await createMutation.mutateAsync(values);
    if (result.success) onOpenChange(false);
  };

  const handleUpdate = async (values: UpdateStageFormValues) => {
    if (!stage) return;
    const result = await updateMutation.mutateAsync({
      stageId: stage.id,
      values,
    });
    if (result.success) onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const formError = createMutation.data?.message || updateMutation.data?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editTitle") : t("createFormTitle")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {isEdit ? (
          <form
            onSubmit={updateForm.handleSubmit(handleUpdate)}
            className="space-y-4"
          >
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

            <FormField label={t("descriptionAr")}>
              <Textarea {...updateForm.register("description_ar")} />
            </FormField>

            <FormField label={t("descriptionEn")}>
              <Textarea {...updateForm.register("description_en")} />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label={t("ageMin")}
                error={updateForm.formState.errors.age_min?.message}
              >
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="0"
                  {...updateForm.register("age_min", {
                    setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                  })}
                />
              </FormField>

              <FormField
                label={t("ageMax")}
                error={updateForm.formState.errors.age_max?.message}
              >
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="100"
                  {...updateForm.register("age_max", {
                    setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                  })}
                />
              </FormField>
            </div>

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
              label={t("nameAr")}
              error={createForm.formState.errors.name_ar?.message}
              required
            >
              <Input {...createForm.register("name_ar")} />
            </FormField>

            <FormField label={t("nameEn")}>
              <Input {...createForm.register("name_en")} />
            </FormField>

            <FormField label={t("descriptionAr")}>
              <Textarea {...createForm.register("description_ar")} />
            </FormField>

            <FormField label={t("descriptionEn")}>
              <Textarea {...createForm.register("description_en")} />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label={t("ageMin")}
                error={createForm.formState.errors.age_min?.message}
              >
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="0"
                  {...createForm.register("age_min", {
                    setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                  })}
                />
              </FormField>

              <FormField
                label={t("ageMax")}
                error={createForm.formState.errors.age_max?.message}
              >
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="100"
                  {...createForm.register("age_max", {
                    setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                  })}
                />
              </FormField>
            </div>

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
