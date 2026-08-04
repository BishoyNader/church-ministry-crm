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
import { useArchiveClass } from "../hooks/use-classes";
import type { ClassListItem } from "../types/classes.types";

type DeleteClassDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classItem: ClassListItem | null;
};

export function DeleteClassDialog({
  open,
  onOpenChange,
  classItem,
}: DeleteClassDialogProps) {
  const t = useTranslations("classes.archive");
  const archiveMutation = useArchiveClass();

  const handleArchive = async () => {
    if (!classItem) return;
    const result = await archiveMutation.mutateAsync(classItem.id);
    if (result.success) onOpenChange(false);
  };

  const error = archiveMutation.data?.success === false
    ? archiveMutation.data.message
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { name: classItem?.name_ar ?? "" })}
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
            onClick={handleArchive}
            disabled={archiveMutation.isPending}
          >
            {archiveMutation.isPending ? t("processing") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
