"use client";

import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDeactivateChild } from "../hooks/use-children";
import type { ChildListItem } from "../types/child.types";

type ChildDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  child: ChildListItem | null;
};

export function ChildDeleteDialog({
  open,
  onOpenChange,
  child,
}: ChildDeleteDialogProps) {
  const t = useTranslations("children.delete");
  const deactivateMutation = useDeactivateChild();

  const handleDeactivate = async () => {
    if (!child) return;
    const result = await deactivateMutation.mutateAsync(child.id);
    if (result.success) onOpenChange(false);
  };

  const error =
    deactivateMutation.data?.success === false
      ? deactivateMutation.data.message
      : null;

  const childName = child ? child.full_name_ar : "";

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description", { name: childName })}
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
