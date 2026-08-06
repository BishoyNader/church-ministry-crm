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
} from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t(`statusDialog.${status}.title`)}</DialogTitle>
          <DialogDescription>{t(`statusDialog.${status}.description`)}</DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant={status === "disabled" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? t("statusDialog.saving") : t(`statusDialog.${status}.confirm`)}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
