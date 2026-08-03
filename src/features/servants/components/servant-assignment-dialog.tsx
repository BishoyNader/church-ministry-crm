"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useServantStages, useAssignServantStages } from "../hooks/use-servants";
import type { ServantListItem } from "../types/servant.types";

type ServantAssignmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servant: ServantListItem;
};

export function ServantAssignmentDialog({
  open,
  onOpenChange,
  servant,
}: ServantAssignmentDialogProps) {
  const t = useTranslations("servants.assign");
  const stagesQuery = useServantStages();
  const assignMutation = useAssignServantStages();

  const stages = stagesQuery.data?.data ?? [];

  const [selectedIds, setSelectedIds] = useState<string[]>(
    () =>
      servant.stageAssignments
        .map((assignment) => assignment.stage_id)
        .filter((id): id is string => id !== null),
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const toggle = (stageId: string) => {
    setSelectedIds((prev) =>
      prev.includes(stageId)
        ? prev.filter((id) => id !== stageId)
        : [...prev, stageId],
    );
  };

  const handleSave = async () => {
    setActionError(null);
    const result = await assignMutation.mutateAsync({
      servantId: servant.id,
      stageIds: selectedIds,
    });

    if (!result.success) {
      setActionError(result.message ?? t("errors.general"));
      return;
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { name: servant.profile?.full_name_ar ?? "" })}
          </DialogDescription>
        </DialogHeader>

        {actionError ? (
          <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {actionError}
          </div>
        ) : null}

        <div className="max-h-80 space-y-2 overflow-y-auto py-2">
          {stagesQuery.isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
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
