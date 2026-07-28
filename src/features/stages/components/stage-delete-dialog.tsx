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
import { useDeactivateStage } from "../hooks/use-stages";
import type { StageListItem } from "../types/stage.types";

type StageDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: StageListItem | null;
};

export function StageDeleteDialog({
  open,
  onOpenChange,
  stage,
}: StageDeleteDialogProps) {
  const t = useTranslations("stages.stage.delete");
  const deactivateMutation = useDeactivateStage();

  const handleDeactivate = async () => {
    if (!stage) return;
    const result = await deactivateMutation.mutateAsync(stage.id);
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
            {t("description", { name: stage?.name_ar ?? "" })}
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
