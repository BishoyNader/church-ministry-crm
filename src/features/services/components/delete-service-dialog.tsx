"use client";

import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useArchiveService } from "../hooks/use-services";
import type { ServiceListItem } from "../types/services.types";

type DeleteServiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceListItem | null;
};

export function DeleteServiceDialog({
  open,
  onOpenChange,
  service,
}: DeleteServiceDialogProps) {
  const t = useTranslations("services.archive");
  const archiveMutation = useArchiveService();

  const handleArchive = async () => {
    if (!service) return;
    const result = await archiveMutation.mutateAsync(service.id);
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
      description={t("description", { name: service?.name_ar ?? "" })}
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
