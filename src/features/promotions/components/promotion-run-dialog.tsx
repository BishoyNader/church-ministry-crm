"use client";

import { useEffect, useState } from "react";
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
import { useStageList } from "@/features/stages";
import { useRunAnnualPromotions } from "../hooks/use-promotions";

const runSchema = z.object({
  stageId: z.string().min(1, "Stage is required."),
  academicYear: z.number().int().min(2000).max(2100),
  notes: z.string().optional(),
});

type RunFormValues = z.infer<typeof runSchema>;

type PromotionRunDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PromotionRunDialog({ open, onOpenChange }: PromotionRunDialogProps) {
  const t = useTranslations("promotions.run");
  const stagesQuery = useStageList();
  const stages = stagesQuery.data?.data ?? [];
  const runMutation = useRunAnnualPromotions();

  const form = useForm<RunFormValues>({
    resolver: zodResolver(runSchema),
    defaultValues: {
      stageId: "",
      academicYear: new Date().getFullYear(),
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ stageId: "", academicYear: new Date().getFullYear(), notes: "" });
    }
  }, [open, form]);

  const handleSubmit = async (values: RunFormValues) => {
    const result = await runMutation.mutateAsync({
      stageId: values.stageId,
      academicYear: values.academicYear,
      notes: values.notes || null,
    });
    if (result.success) {
      onOpenChange(false);
    }
  };

  const formError = runMutation.data?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField label={t("stage")} error={form.formState.errors.stageId?.message} required>
            <Select
              value={form.watch("stageId")}
              onValueChange={(value) => {
                if (typeof value === "string") form.setValue("stageId", value, { shouldValidate: true });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("stagePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {stages.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {t("noStages")}
                  </div>
                ) : (
                  stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name_ar ?? stage.name_en ?? ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t("year")} error={form.formState.errors.academicYear?.message} required>
            <Input
              type="number"
              min={2000}
              max={2100}
              {...form.register("academicYear", { valueAsNumber: true })}
            />
          </FormField>

          <FormField label={t("notes")}>
            <Textarea rows={3} {...form.register("notes")} />
          </FormField>

          {formError ? <p className="text-xs text-destructive">{formError}</p> : null}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" disabled={runMutation.isPending}>
              {runMutation.isPending ? t("processing") : t("run")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
