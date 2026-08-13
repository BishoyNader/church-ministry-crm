"use client";

import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useDeactivateChurch,
  useDisableChurch,
  useReactivateChurch,
  useSuspendChurch,
} from "../hooks/use-churches";
import type { ChurchStatus } from "../types/church.types";

type ChurchStatusConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  status: ChurchStatus;
};

export function ChurchStatusConfirmDialog({
  open,
  onOpenChange,
  churchId,
  status,
}: ChurchStatusConfirmDialogProps) {
  const t = useTranslations("churches");

  const deactivate = useDeactivateChurch();
  const suspend = useSuspendChurch();
  const disable = useDisableChurch();
  const reactivate = useReactivateChurch();

  const mutation =
    status === "active"
      ? reactivate
      : status === "inactive"
        ? deactivate
        : status === "suspended"
          ? suspend
          : disable;

  const isSubmitting = mutation.isPending;
  const errorMessage = mutation.error?.message ?? null;

  const handleConfirm = async () => {
    try {
      await mutation.mutateAsync(churchId);
      onOpenChange(false);
    } catch {
      // Error surfaced via mutation.error
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(`statusDialog.${status}.title`)}
      description={t(`statusDialog.${status}.description`)}
      confirmLabel={t(`statusDialog.${status}.confirm`)}
      cancelLabel={t("cancel")}
      processingLabel={t("statusDialog.saving")}
      destructive={status === "disabled"}
      isSubmitting={isSubmitting}
      errorMessage={errorMessage}
      onConfirm={handleConfirm}
    />
  );
}
