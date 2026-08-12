"use client";

import { useEffect } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
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
  createServiceWithStagesSchema,
  updateServiceSchema,
} from "../schemas/services.schema";
import type {
  CreateServiceWithStagesFormValues,
  UpdateServiceFormValues,
} from "../schemas/services.schema";
import {
  useCreateServiceWithStages,
  useUpdateService,
} from "../hooks/use-services";
import type { ServiceListItem } from "../types/services.types";
import { FormField } from "@/components/ui/form-field";
import { ServiceStagesSection } from "./service-stages-section";

type ServiceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: ServiceListItem | null;
};

export function ServiceFormDialog({
  open,
  onOpenChange,
  service,
}: ServiceFormDialogProps) {
  const t = useTranslations("services.form");
  const isEdit = !!service;

  const createMutation = useCreateServiceWithStages();
  const updateMutation = useUpdateService();

  const createForm = useForm<CreateServiceWithStagesFormValues>({
    resolver: zodResolver(createServiceWithStagesSchema),
    defaultValues: {
      name_ar: "",
      name_en: "",
      description_ar: "",
      description_en: "",
      sort_order: 0,
      stages: [],
    },
  });

  const stageArray = useFieldArray({
    control: createForm.control,
    name: "stages",
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
    }
  }, [service, updateForm]);

  const updateIsActive = useWatch({
    control: updateForm.control,
    name: "is_active",
  });

  const handleCreate = async (values: CreateServiceWithStagesFormValues) => {
    // The resolver already validated the raw form values; parse once more to
    // get the coerced output (empty age inputs → undefined) for the action.
    const parsed = createServiceWithStagesSchema.parse(values);
    const result = await createMutation.mutateAsync(parsed);
    if (result.success) {
      // The service plus its stages were created together in one action.
      onOpenChange(false);
    }
  };

  const handleUpdate = async (values: UpdateServiceFormValues) => {
    if (!service) return;
    const result = await updateMutation.mutateAsync({
      serviceId: service.id,
      values,
    });
    if (result.success) onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const formError = createMutation.data?.message || updateMutation.data?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-2xl overflow-y-auto">
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

            {service && (
              <ServiceStagesSection serviceId={service.id} />
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

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t("stages")}</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    stageArray.append({ name_ar: "", name_en: "", age_min: undefined, age_max: undefined })
                  }
                >
                  <Plus className="h-4 w-4" />
                  {t("addStage")}
                </Button>
              </div>

              {stageArray.fields.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("noStages")}</p>
              ) : (
                <div className="space-y-4">
                  {stageArray.fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="space-y-3 rounded-md border p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          {t("stage", { index: index + 1 })}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("removeStage")}
                          onClick={() => stageArray.remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField
                          label={t("stageNameAr")}
                          error={
                            createForm.formState.errors.stages?.[index]?.name_ar
                              ?.message
                          }
                          required
                        >
                          <Input {...createForm.register(`stages.${index}.name_ar`)} />
                        </FormField>

                        <FormField label={t("stageNameEn")}>
                          <Input {...createForm.register(`stages.${index}.name_en`)} />
                        </FormField>

                        <FormField label={t("ageMin")}>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            {...createForm.register(`stages.${index}.age_min`)}
                          />
                        </FormField>

                        <FormField label={t("ageMax")}>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            {...createForm.register(`stages.${index}.age_max`)}
                          />
                        </FormField>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
