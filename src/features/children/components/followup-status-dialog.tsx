"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
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
import { updateFollowupSchema } from "../schemas/child.schema";
import type { UpdateFollowupFormValues } from "../schemas/child.schema";
import { useUpdateFollowup } from "../hooks/use-followups";
import type { FollowupListItem } from "../types/child.types";
import { FormField } from "@/features/stages/components/form-field";

const FOLLOWUP_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

type FollowupStatusDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followup: FollowupListItem | null;
};

export function FollowupStatusDialog({
  open,
  onOpenChange,
  followup,
}: FollowupStatusDialogProps) {
  const t = useTranslations("children");
  const tDetail = useTranslations("children.detail");

  const updateMutation = useUpdateFollowup();

  const form = useForm<UpdateFollowupFormValues>({
    resolver: zodResolver(updateFollowupSchema),
    defaultValues: {
      status: undefined,
      outcome: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (followup) {
      form.reset({
        status: followup.status,
        outcome: followup.outcome ?? "",
        notes: followup.notes ?? "",
      });
    }
  }, [followup, form]);

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const handleSubmit = async (values: UpdateFollowupFormValues) => {
    if (!followup) return;
    const result = await updateMutation.mutateAsync({
      followupId: followup.id,
      values,
    });
    if (result.success) onOpenChange(false);
  };

  const isPending = updateMutation.isPending;
  const mutationData = updateMutation.data;

  const formError =
    mutationData?.success === false ? mutationData.message : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("followups.statusDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("followups.statusDialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {followup?.childFirstNameAr} {followup?.childLastNameAr}
            </span>
            {" / "}
            {followup?.type ? tDetail(`followupType.${followup.type}`) : "\u2014"}
          </div>

          <FormField
            label={t("followups.status")}
            error={form.formState.errors.status?.message}
            required
          >
            <Select
              value={form.watch("status") ?? ""}
              onValueChange={(value) =>
                form.setValue(
                  "status",
                  value as UpdateFollowupFormValues["status"],
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("followups.selectStatus")} />
              </SelectTrigger>
              <SelectContent>
                {FOLLOWUP_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {tDetail(`followupStatus.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t("followups.outcome")}>
            <Textarea {...form.register("outcome")} />
          </FormField>

          <FormField label={t("followups.notes")}>
            <Textarea {...form.register("notes")} />
          </FormField>

          {formError ? (
            <p className="text-xs text-destructive">{formError}</p>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {t("followups.cancel")}
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("followups.processing") : t("followups.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
