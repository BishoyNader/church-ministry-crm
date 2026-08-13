"use client";

import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDeactivateStage } from "../hooks/use-stages";
import type { StageListItem } from "../types/stage.types";

type StageDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: StageListItem | null;
  onSuccess?: () => void;
};

export function StageDeleteDialog({
  open,
  onOpenChange,
  stage,
  onSuccess,
}: StageDeleteDialogProps) {
  const t = useTranslations("stages.stage.delete");
  const deactivateMutation = useDeactivateStage();

  const handleDeactivate = async () => {
    if (!stage) return;
    const result = await deactivateMutation.mutateAsync(stage.id);
    if (result.success) {
      onSuccess?.();
      onOpenChange(false);
    }
  };

  const error = deactivateMutation.data?.success === false
    ? deactivateMutation.data.message
    : null;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description", { name: stage?.name_ar ?? "" })}
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
