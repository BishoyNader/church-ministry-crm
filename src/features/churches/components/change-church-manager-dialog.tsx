"use client";

import { useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChurchUsers, useChangeChurchManager } from "../hooks/use-churches";
import type { ChurchUserRow } from "../types/church.types";

type ChangeChurchManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  currentManagerId: string | null | undefined;
};

type ManagerPickerProps = {
  users: ChurchUserRow[];
  isLoading: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  onConfirm: (userId: string) => void;
  onCancel: () => void;
};

function ManagerPicker({
  users,
  isLoading,
  isSubmitting,
  errorMessage,
  onConfirm,
  onCancel,
}: ManagerPickerProps) {
  const t = useTranslations("churches");
  const [selectedUserId, setSelectedUserId] = useState("");

  return (
    <>
      {errorMessage && (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <Select value={selectedUserId} onValueChange={(value) => setSelectedUserId(String(value))}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("manager.selectPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{t("manager.loading")}</div>
          ) : users.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{t("manager.noCandidates")}</div>
          ) : (
            users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.fullNameAr} · {user.email}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t("cancel")}
        </Button>
        <Button type="button" onClick={() => onConfirm(selectedUserId)} disabled={isSubmitting || !selectedUserId}>
          {isSubmitting ? t("manager.saving") : t("manager.confirm")}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ChangeChurchManagerDialog({
  open,
  onOpenChange,
  churchId,
  currentManagerId,
}: ChangeChurchManagerDialogProps) {
  const t = useTranslations("churches");
  const { data, isLoading } = useChurchUsers(churchId, { pageSize: 100 });
  const mutation = useChangeChurchManager();

  const users = (data?.data?.rows ?? []).filter(
    (user) => user.id !== currentManagerId && user.isActive,
  );

  const handleConfirm = async (userId: string) => {
    if (!userId) return;
    try {
      await mutation.mutateAsync({ churchId, newUserId: userId });
      onOpenChange(false);
    } catch {
      // Error surfaced via mutation.error
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("manager.changeTitle")}</DialogTitle>
          <DialogDescription>{t("manager.changeDescription")}</DialogDescription>
        </DialogHeader>

        {open && (
          <ManagerPicker
            users={users}
            isLoading={isLoading}
            isSubmitting={mutation.isPending}
            errorMessage={mutation.error?.message ?? null}
            onConfirm={handleConfirm}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogPopup>
    </Dialog>
  );
}
