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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { name: service?.name_ar ?? "" })}
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
