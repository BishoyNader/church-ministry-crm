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

export type ApprovalResult =
  | {
      type: "success" | "error";
      requestName: string;
      inviteLink: string | null;
      message?: string;
    }
  | null;

type ApprovalResultDialogProps = {
  result: ApprovalResult;
  onOpenChange: (open: boolean) => void;
};

export function ApprovalResultDialog({ result, onOpenChange }: ApprovalResultDialogProps) {
  const t = useTranslations("admin.churchRequests");

  const open = !!result;
  const isSuccess = result?.type === "success";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {isSuccess ? t("approveDialog.successTitle") : t("approveDialog.errorTitle")}
          </DialogTitle>
          <DialogDescription>
            {isSuccess
              ? t("approveDialog.successDescription")
              : (result?.message ?? t("errors.general"))}
          </DialogDescription>
        </DialogHeader>

        {result?.inviteLink ? (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t("approveDialog.inviteLabel")}</p>
            <code className="block break-all rounded-lg bg-muted px-3 py-2 text-xs">
              {result.inviteLink}
            </code>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {isSuccess ? t("approveDialog.close") : t("approveDialog.closeError")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
