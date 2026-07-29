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

  const childName = child
    ? `${child.first_name_ar} ${child.last_name_ar}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { name: childName })}
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

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
