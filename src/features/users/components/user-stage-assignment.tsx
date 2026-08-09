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
import { useUserDetail, useAssignStages, useStages } from "../hooks/use-users";

type UserStageAssignmentProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  churchId?: string;
};

export function UserStageAssignment({
  open,
  onOpenChange,
  userId,
  churchId,
}: UserStageAssignmentProps) {
  const t = useTranslations("users.stages");
  const detailQuery = useUserDetail(userId, churchId);
  const assignMutation = useAssignStages();

  const user = detailQuery.data?.data;
  const scopeChurchId = churchId ?? user?.church_id ?? null;
  const stagesQuery = useStages(scopeChurchId);
  const stages = stagesQuery.data?.data ?? [];

  const [selectedIds, setSelectedIds] = useState<string[]>(
    () => user?.stageAssignments.map((s) => s.stage_id).filter((id): id is string => id !== null) ?? [],
  );

  const toggle = (stageId: string) => {
    setSelectedIds((prev) =>
      prev.includes(stageId) ? prev.filter((id) => id !== stageId) : [...prev, stageId],
    );
  };

  const handleSave = async () => {
    const result = await assignMutation.mutateAsync({
      userId,
      stageIds: selectedIds,
      churchId: scopeChurchId ?? undefined,
    });
    if (result.success) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { name: user?.full_name_ar ?? "" })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {stagesQuery.isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))
            : stages.length === 0
              ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {t("empty")}
                  </p>
                )
              : stages.map((stage) => (
                  <label
                    key={stage.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <Checkbox
                      checked={selectedIds.includes(stage.id)}
                      onCheckedChange={() => toggle(stage.id)}
                    />
                    <div>
                      <p className="text-sm font-medium">{stage.name_ar}</p>
                      {stage.name_en ? (
                        <p className="text-xs text-muted-foreground">{stage.name_en}</p>
                      ) : null}
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
      </DialogPopup>
    </Dialog>
  );
}
