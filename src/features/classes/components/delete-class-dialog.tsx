"use client";

import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description", { name: classItem?.name_ar ?? "" })}
      confirmLabel={t("confirm")}
      cancelLabel={t("cancel")}
      processingLabel={t("processing")}
      destructive
      isSubmitting={archiveMutation.isPending}
      errorMessage={error}
      onConfirm={handleArchive}
    />
  );
}
