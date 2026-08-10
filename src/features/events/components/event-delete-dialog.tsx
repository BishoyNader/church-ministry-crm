"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { name: event?.title_ar ?? "" })}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("cancel")}
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? t("processing") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
