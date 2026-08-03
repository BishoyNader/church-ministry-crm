"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
  createSpiritualJournalSchema,
  updateSpiritualJournalSchema,
} from "../schemas/spiritual-journal.schema";
import type {
  CreateSpiritualJournalFormValues,
  UpdateSpiritualJournalFormValues,
} from "../schemas/spiritual-journal.schema";
import { useCreateSpiritualJournalEntry, useUpdateSpiritualJournalEntry } from "../hooks/use-spiritual-journal";
import type { SpiritualJournalEntry } from "../types/spiritual-journal.types";
import { FormField } from "@/components/ui/form-field";

type SpiritualJournalFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: SpiritualJournalEntry | null;
};

export function SpiritualJournalFormDialog({ open, onOpenChange, entry }: SpiritualJournalFormDialogProps) {
  const t = useTranslations("spiritualJournal");
  const isEdit = !!entry;

  const createMutation = useCreateSpiritualJournalEntry();
  const updateMutation = useUpdateSpiritualJournalEntry();

  const createForm = useForm<CreateSpiritualJournalFormValues>({
    resolver: zodResolver(createSpiritualJournalSchema),
    defaultValues: {
      entryDate: new Date().toISOString().slice(0, 10),
      prayerCompleted: false,
      bibleReading: false,
      liturgyAttendance: false,
      confession: false,
      spiritualNotes: "",
    },
  });

  const updateForm = useForm<UpdateSpiritualJournalFormValues>({
    resolver: zodResolver(updateSpiritualJournalSchema),
    defaultValues: {
      prayerCompleted: false,
      bibleReading: false,
      liturgyAttendance: false,
      confession: false,
      spiritualNotes: "",
    },
  });

  useEffect(() => {
    if (isEdit && entry) {
      updateForm.reset({
        prayerCompleted: entry.prayerCompleted,
        bibleReading: entry.bibleReading,
        liturgyAttendance: entry.liturgyAttendance,
        confession: entry.confession,
        spiritualNotes: entry.spiritualNotes ?? "",
      });
    }
  }, [isEdit, entry, updateForm]);

  useEffect(() => {
    if (!open) {
      createForm.reset();
      updateForm.reset();
    }
  }, [open, createForm, updateForm]);

  const handleCreate = async (values: CreateSpiritualJournalFormValues) => {
    const result = await createMutation.mutateAsync(values);
    if (result.success) onOpenChange(false);
  };

  const handleUpdate = async (values: UpdateSpiritualJournalFormValues) => {
    if (!entry) return;
    const result = await updateMutation.mutateAsync({ entryId: entry.id, values });
    if (result.success) onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const formError = createMutation.data?.message || updateMutation.data?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("formDescription")}</DialogDescription>
        </DialogHeader>

        {isEdit ? (
          <form onSubmit={updateForm.handleSubmit(handleUpdate)} className="space-y-4">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={updateForm.watch("prayerCompleted")}
                  onCheckedChange={(checked) => updateForm.setValue("prayerCompleted", checked === true)}
                />
                {t("prayerCompleted")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={updateForm.watch("bibleReading")}
                  onCheckedChange={(checked) => updateForm.setValue("bibleReading", checked === true)}
                />
                {t("bibleReading")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={updateForm.watch("liturgyAttendance")}
                  onCheckedChange={(checked) => updateForm.setValue("liturgyAttendance", checked === true)}
                />
                {t("liturgyAttendance")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={updateForm.watch("confession")}
                  onCheckedChange={(checked) => updateForm.setValue("confession", checked === true)}
                />
                {t("confession")}
              </label>
            </div>

            <FormField label={t("notes")}>
              <Textarea {...updateForm.register("spiritualNotes")} />
            </FormField>

            {formError ? <p className="text-xs text-destructive">{formError}</p> : null}

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
          <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
            <FormField
              label={t("date")}
              error={createForm.formState.errors.entryDate?.message}
              required
            >
              <Input type="date" {...createForm.register("entryDate")} />
            </FormField>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={createForm.watch("prayerCompleted")}
                  onCheckedChange={(checked) => createForm.setValue("prayerCompleted", checked === true)}
                />
                {t("prayerCompleted")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={createForm.watch("bibleReading")}
                  onCheckedChange={(checked) => createForm.setValue("bibleReading", checked === true)}
                />
                {t("bibleReading")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={createForm.watch("liturgyAttendance")}
                  onCheckedChange={(checked) => createForm.setValue("liturgyAttendance", checked === true)}
                />
                {t("liturgyAttendance")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={createForm.watch("confession")}
                  onCheckedChange={(checked) => createForm.setValue("confession", checked === true)}
                />
                {t("confession")}
              </label>
            </div>

            <FormField label={t("notes")}>
              <Textarea {...createForm.register("spiritualNotes")} />
            </FormField>

            {formError ? <p className="text-xs text-destructive">{formError}</p> : null}

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