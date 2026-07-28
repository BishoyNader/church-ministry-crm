"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useStageUsers,
  useAllUsers,
  useAssignUsersToStage,
} from "../hooks/use-stages";
import type { StageListItem } from "../types/stage.types";

type StageUserAssignmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: StageListItem | null;
};

export function StageUserAssignmentDialog({
  open,
  onOpenChange,
  stage,
}: StageUserAssignmentDialogProps) {
  const key = stage?.id ?? "none";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-lg" key={key}>
        {open && stage && (
          <StageUserAssignmentContent
            stage={stage}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogPopup>
    </Dialog>
  );
}

function StageUserAssignmentContent({
  stage,
  onOpenChange,
}: {
  stage: StageListItem;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("stages.assignment");
  const stageUsersQuery = useStageUsers(stage.id);
  const allUsersQuery = useAllUsers();
  const assignMutation = useAssignUsersToStage();

  const stageUsers = stageUsersQuery.data?.data ?? [];
  const allUsers = allUsersQuery.data?.data ?? [];

  const initialIds = stageUsers.map((u) => u.id);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);

  const toggle = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleSave = async () => {
    const result = await assignMutation.mutateAsync({
      stageId: stage.id,
      userIds: selectedIds,
    });
    if (result.success) onOpenChange(false);
  };

  const isLoading = stageUsersQuery.isLoading || allUsersQuery.isLoading;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>
          {t("description", { name: stage.name_ar })}
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-80 space-y-2 overflow-y-auto py-2">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))
          : allUsers.length === 0
            ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </p>
              )
            : allUsers.map((user) => (
                <label
                  key={user.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <Checkbox
                    checked={selectedIds.includes(user.id)}
                    onCheckedChange={() => toggle(user.id)}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {user.full_name_ar}
                    </p>
                    {user.email && (
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    )}
                  </div>
                </label>
              ))}
      </div>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>
          {t("cancel")}
        </DialogClose>
        <Button onClick={handleSave} disabled={assignMutation.isPending}>
          {assignMutation.isPending ? t("processing") : t("save")}
        </Button>
      </DialogFooter>
    </>
  );
}
