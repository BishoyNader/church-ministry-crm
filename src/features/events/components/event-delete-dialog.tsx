"use client";

import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDeleteEvent } from "../hooks/use-events";
import type { EventListItem } from "../types/events.types";

type EventDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventListItem | null;
};

export function EventDeleteDialog({
  open,
  onOpenChange,
  event,
}: EventDeleteDialogProps) {
  const t = useTranslations("events.delete");
  const deleteMutation = useDeleteEvent();

  const handleDelete = async () => {
    if (!event) return;
    const result = await deleteMutation.mutateAsync(event.id);
    if (result.success) onOpenChange(false);
  };

  const error = deleteMutation.data?.success === false
    ? deleteMutation.data.message
    : null;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description", { name: event?.title_ar ?? "" })}
      confirmLabel={t("confirm")}
      cancelLabel={t("cancel")}
      processingLabel={t("processing")}
      destructive
      isSubmitting={deleteMutation.isPending}
      errorMessage={error}
      onConfirm={handleDelete}
    />
  );
}
