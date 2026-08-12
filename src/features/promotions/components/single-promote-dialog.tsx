"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Skeleton } from "@/components/ui/skeleton";
import { useChildList } from "@/features/children";
import { useStageList } from "@/features/stages";
import { useRunSinglePromotion } from "../hooks/use-promotions";

const singlePromoteSchema = z.object({
  beneficiaryId: z.string().min(1, "Beneficiary is required."),
  targetStageId: z.string().min(1, "Target stage is required."),
  academicYear: z.number().int().min(2000).max(2100),
  note: z.string().optional(),
});

type SinglePromoteFormValues = z.infer<typeof singlePromoteSchema>;

type SinglePromoteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SinglePromoteDialog({ open, onOpenChange }: SinglePromoteDialogProps) {
  const t = useTranslations("promotions.single");
  const [search, setSearch] = useState("");
  const childrenQuery = useChildList({ search: search || undefined }, { page: 1, pageSize: 30 });
  const children = childrenQuery.data?.data?.data ?? [];
  const stagesQuery = useStageList();
  const stages = stagesQuery.data?.data ?? [];
  const promoteMutation = useRunSinglePromotion();

  const form = useForm<SinglePromoteFormValues>({
    resolver: zodResolver(singlePromoteSchema),
    defaultValues: {
      beneficiaryId: "",
      targetStageId: "",
      academicYear: new Date().getFullYear(),
      note: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        beneficiaryId: "",
        targetStageId: "",
        academicYear: new Date().getFullYear(),
        note: "",
      });
      setSearch("");
    }
  }, [open, form]);

  const watchedBeneficiaryId = form.watch("beneficiaryId");
  const selectedChild = children.find((child) => child.id === watchedBeneficiaryId);

  const targetStages = useMemo(() => {
    if (!selectedChild?.serviceId) return [];
    return stages.filter(
      (stage) =>
        stage.service_id === selectedChild.serviceId && stage.id !== selectedChild.stageId,
    );
  }, [stages, selectedChild]);

  useEffect(() => {
    if (selectedChild && !targetStages.some((stage) => stage.id === form.getValues("targetStageId"))) {
      form.setValue("targetStageId", "");
    }
  }, [selectedChild, targetStages, form]);

  const handleSubmit = async (values: SinglePromoteFormValues) => {
    const result = await promoteMutation.mutateAsync({
      beneficiaryId: values.beneficiaryId,
      targetStageId: values.targetStageId,
      academicYear: values.academicYear,
      note: values.note || null,
    });
    if (result.success) {
      onOpenChange(false);
    }
  };

  const formError = promoteMutation.data?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            label={t("beneficiary")}
            error={form.formState.errors.beneficiaryId?.message}
            required
          >
            <Input
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="mb-2"
            />
            {childrenQuery.isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
            <Select
              value={watchedBeneficiaryId}
              onValueChange={(value) => {
                if (typeof value === "string")
                  form.setValue("beneficiaryId", value, { shouldValidate: true });
              }}
            >
                <SelectTrigger>
                  <SelectValue placeholder={t("beneficiaryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {children.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {t("noBeneficiaries")}
                    </div>
                  ) : (
                    children.map((child) => (
                      <SelectItem key={child.id} value={child.id}>
                        {child.full_name_ar ?? child.full_name_en ?? ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField
            label={t("targetStage")}
            error={form.formState.errors.targetStageId?.message}
            required
          >
            <Select
              value={form.watch("targetStageId")}
              onValueChange={(value) => {
                if (typeof value === "string")
                  form.setValue("targetStageId", value, { shouldValidate: true });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("targetStagePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {targetStages.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {t("noTargetStages")}
                  </div>
                ) : (
                  targetStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name_ar ?? stage.name_en ?? ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label={t("year")}
            error={form.formState.errors.academicYear?.message}
            required
          >
            <Input
              type="number"
              min={2000}
              max={2100}
              {...form.register("academicYear", { valueAsNumber: true })}
            />
          </FormField>

          <FormField label={t("note")}>
            <Textarea rows={2} {...form.register("note")} />
          </FormField>

          {formError ? <p className="text-xs text-destructive">{formError}</p> : null}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" disabled={promoteMutation.isPending}>
              {promoteMutation.isPending ? t("processing") : t("promote")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
