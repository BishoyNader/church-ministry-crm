"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useUpdateServant } from "../hooks/use-servants";
import type { ServantListItem } from "../types/servant.types";

type ServantEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servant: ServantListItem;
};

export function ServantEditDialog({
  open,
  onOpenChange,
  servant,
}: ServantEditDialogProps) {
  const t = useTranslations("servants.edit");
  const updateMutation = useUpdateServant();

  const [confessionFather, setConfessionFather] = useState(
    servant.confession_father_name ?? "",
  );
  const [joinDate, setJoinDate] = useState(servant.join_date ?? "");
  const [notes, setNotes] = useState(servant.notes ?? "");
  const [actionError, setActionError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const handleSave = async () => {
    setActionError(null);
    setFieldErrors({});

    const result = await updateMutation.mutateAsync({
      servantId: servant.id,
      values: {
        confession_father_name: confessionFather,
        join_date: joinDate,
        notes,
      },
    });

    if (!result.success) {
      setActionError(result.message ?? t("errors.general"));
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { name: servant.profile?.full_name_ar ?? "" })}
          </DialogDescription>
        </DialogHeader>

        {actionError ? (
          <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {actionError}
          </div>
        ) : null}

        <div className="space-y-4 py-2">
          <FormField label={t("confessionFather")} error={fieldErrors.confession_father_name}>
            <Input
              value={confessionFather}
              onChange={(e) => setConfessionFather(e.target.value)}
              placeholder={t("confessionFatherPlaceholder")}
            />
          </FormField>

          <FormField label={t("joinDate")} error={fieldErrors.join_date}>
            <Input
              type="date"
              value={joinDate}
              onChange={(e) => setJoinDate(e.target.value)}
            />
          </FormField>

          <FormField label={t("notes")} error={fieldErrors.notes}>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPlaceholder")}
              rows={4}
            />
          </FormField>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("cancel")}
          </DialogClose>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? t("processing") : t("save")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
