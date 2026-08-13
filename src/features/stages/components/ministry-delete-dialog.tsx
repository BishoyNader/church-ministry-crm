"use client";

import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDeactivateMinistry } from "../hooks/use-ministries";
import type { MinistryListItem } from "../types/stage.types";

type MinistryDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ministry: MinistryListItem | null;
};

export function MinistryDeleteDialog({
  open,
  onOpenChange,
  ministry,
}: MinistryDeleteDialogProps) {
  const t = useTranslations("stages.ministry.delete");
  const deactivateMutation = useDeactivateMinistry();

  const handleDeactivate = async () => {
    if (!ministry) return;
    const result = await deactivateMutation.mutateAsync(ministry.id);
    if (result.success) onOpenChange(false);
  };

  const error = deactivateMutation.data?.success === false
    ? deactivateMutation.data.message
    : null;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description", { name: ministry?.name_ar ?? "" })}
      confirmLabel={t("confirm")}
      cancelLabel={t("cancel")}
      processingLabel={t("processing")}
      destructive
      isSubmitting={deactivateMutation.isPending}
      errorMessage={error}
      onConfirm={handleDeactivate}
    />
  );
}
