"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useRejectChurchRequest } from "../hooks/use-church-requests";
import type { ChurchRequestRow } from "../types/church-request.admin.types";

type RejectChurchRequestDialogProps = {
  request: ChurchRequestRow | null;
  onOpenChange: (open: boolean) => void;
};

export function RejectChurchRequestDialog({
  request,
  onOpenChange,
}: RejectChurchRequestDialogProps) {
  const t = useTranslations("admin.churchRequests");
  const reject = useRejectChurchRequest();
  const [reason, setReason] = useState("");

  const open = !!request;
  const isSubmitting = reject.isPending;
  const errorMessage = reject.error?.message ?? null;

  const handleConfirm = async () => {
    if (!request) return;
    try {
      await reject.mutateAsync({
        requestId: request.id,
        reason: reason.trim() || undefined,
      });
      setReason("");
      onOpenChange(false);
    } catch {
      // Error surfaced via mutation.error
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason("");
          onOpenChange(false);
        }
      }}
    >
      <DialogPopup className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t("rejectDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("rejectDialog.description", { name: request?.church_name_ar ?? "" })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label htmlFor="reject-reason" className="text-sm font-medium">
            {t("rejectDialog.reasonLabel")}
          </label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("rejectDialog.reasonPlaceholder")}
            rows={4}
            disabled={isSubmitting}
          />
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("rejectDialog.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? t("rejectDialog.processing") : t("rejectDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
