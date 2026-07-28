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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { name: ministry?.name_ar ?? "" })}
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
            onClick={handleDeactivate}
            disabled={deactivateMutation.isPending}
          >
            {deactivateMutation.isPending ? t("processing") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
