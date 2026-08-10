"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  createServiceSchema,
  updateServiceSchema,
} from "../schemas/services.schema";
import type {
  CreateServiceFormValues,
  UpdateServiceFormValues,
} from "../schemas/services.schema";
import { useCreateService, useUpdateService } from "../hooks/use-services";
import type { ServiceListItem } from "../types/services.types";
import { FormField } from "@/components/ui/form-field";
import { ServiceStagesSection } from "./service-stages-section";

type ServiceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: ServiceListItem | null;
};

type CreatedServiceSnapshot = {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  sort_order: number;
  is_active: boolean;
};

export function ServiceFormDialog({
  open,
  onOpenChange,
  service,
}: ServiceFormDialogProps) {
  const t = useTranslations("services.form");
  const [createdService, setCreatedService] = useState<CreatedServiceSnapshot | null>(null);

  const effectiveService = service ?? createdService;
  const isEdit = !!effectiveService;

  const createMutation = useCreateService();
  const updateMutation = useUpdateService();

  const createForm = useForm<CreateServiceFormValues>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: {
      name_ar: "",
      name_en: "",
      description_ar: "",
      description_en: "",
      sort_order: 0,
    },
  });

  const updateForm = useForm<UpdateServiceFormValues>({
    resolver: zodResolver(updateServiceSchema),
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
    if (service) {
      updateForm.reset({
        name_ar: service.name_ar,
        name_en: service.name_en ?? "",
        description_ar: service.description_ar ?? "",
        description_en: service.description_en ?? "",
        sort_order: service.sort_order,
        is_active: service.is_active,
      });
    } else if (createdService) {
      updateForm.reset({
        name_ar: createdService.name_ar,
        name_en: createdService.name_en ?? "",
        description_ar: createdService.description_ar ?? "",
        description_en: createdService.description_en ?? "",
        sort_order: createdService.sort_order,
        is_active: createdService.is_active,
      });
    }
  }, [service, createdService, updateForm]);

  const updateIsActive = useWatch({
    control: updateForm.control,
    name: "is_active",
  });

  const handleCreate = async (values: CreateServiceFormValues) => {
    const result = await createMutation.mutateAsync(values);
    if (result.success && result.data?.id) {
      // Keep the dialog open and switch to edit mode so the newly created
      // service can immediately get its stages (المراحل) managed.
      setCreatedService({
        id: result.data.id,
        name_ar: values.name_ar,
        name_en: values.name_en ?? "",
        description_ar: values.description_ar ?? "",
        description_en: values.description_en ?? "",
        sort_order: values.sort_order ?? 0,
        is_active: true,
      });
    }
  };

  const handleUpdate = async (values: UpdateServiceFormValues) => {
    if (!effectiveService) return;
    const result = await updateMutation.mutateAsync({
      serviceId: effectiveService.id,
      values,
    });
    if (result.success) onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const formError = createMutation.data?.message || updateMutation.data?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup
        className={isEdit ? "sm:max-w-2xl overflow-y-auto" : "sm:max-w-lg"}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editTitle") : t("createTitle")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {isEdit ? (
          <>
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

            {effectiveService && (
              <ServiceStagesSection serviceId={effectiveService.id} />
            )}
          </>
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
