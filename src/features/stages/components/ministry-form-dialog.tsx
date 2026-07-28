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
  createMinistrySchema,
  updateMinistrySchema,
} from "../schemas/stage.schema";
import type {
  CreateMinistryFormValues,
  UpdateMinistryFormValues,
} from "../schemas/stage.schema";
import { useCreateMinistry, useUpdateMinistry } from "../hooks/use-ministries";
import type { MinistryListItem } from "../types/stage.types";
import { FormField } from "./form-field";

type MinistryFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ministry?: MinistryListItem | null;
};

export function MinistryFormDialog({
  open,
  onOpenChange,
  ministry,
}: MinistryFormDialogProps) {
  const t = useTranslations("stages.ministry.form");
  const isEdit = !!ministry;

  const createMutation = useCreateMinistry();
  const updateMutation = useUpdateMinistry();

  const createForm = useForm<CreateMinistryFormValues>({
    resolver: zodResolver(createMinistrySchema),
    defaultValues: {
      name_ar: "",
      name_en: "",
      description_ar: "",
      description_en: "",
      sort_order: 0,
    },
  });

  const updateForm = useForm<UpdateMinistryFormValues>({
    resolver: zodResolver(updateMinistrySchema),
    defaultValues: {
      name_ar: "",
      name_en: "",
      description_ar: "",
      description_en: "",
      sort_order: 0,
      is_active: true,
    },
  });

  useEffect(() => {
    if (isEdit && ministry) {
      updateForm.reset({
        name_ar: ministry.name_ar,
        name_en: ministry.name_en ?? "",
        description_ar: ministry.description_ar ?? "",
        description_en: ministry.description_en ?? "",
        sort_order: ministry.sort_order,
        is_active: ministry.is_active,
      });
    }
  }, [isEdit, ministry, updateForm]);

  const handleCreate = async (values: CreateMinistryFormValues) => {
    const result = await createMutation.mutateAsync(values);
    if (result.success) onOpenChange(false);
  };

  const handleUpdate = async (values: UpdateMinistryFormValues) => {
    if (!ministry) return;
    const result = await updateMutation.mutateAsync({
      ministryId: ministry.id,
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
