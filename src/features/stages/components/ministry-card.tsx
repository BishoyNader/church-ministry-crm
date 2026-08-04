"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Edit, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PermissionGuard } from "@/features/rbac";
import { StageRow } from "./stage-row";
import type { MinistryListItem, StageListItem } from "../types/stage.types";

type MinistryCardProps = {
  ministry: MinistryListItem;
  stages: StageListItem[];
  onEditMinistry: (ministry: MinistryListItem) => void;
  onDeactivateMinistry: (ministry: MinistryListItem) => void;
  onCreateStage: (ministryId: string) => void;
  onEditStage: (stage: StageListItem) => void;
  onDeactivateStage: (stage: StageListItem) => void;
  onAssignUsers: (stage: StageListItem) => void;
};

export function MinistryCard({
  ministry,
  stages,
  onEditMinistry,
  onDeactivateMinistry,
  onCreateStage,
  onEditStage,
  onDeactivateStage,
  onAssignUsers,
}: MinistryCardProps) {
  const t = useTranslations("stages.ministry");
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="shrink-0 text-muted-foreground transition hover:text-foreground"
            aria-label={t("toggleStages")}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold truncate">
                {ministry.name_ar}
              </h3>
              {!ministry.is_active && (
                <Badge variant="destructive" className="text-[10px]">
                  {t("status.inactive")}
                </Badge>
              )}
            </div>
            {ministry.name_en && (
              <p className="text-xs text-muted-foreground truncate">
                {ministry.name_en}
              </p>
            )}
          </div>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {t("stagesCount", { count: ministry.stageCount })}
          </Badge>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <PermissionGuard permission="stages.create">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onCreateStage(ministry.id)}
              aria-label={t("addStage")}
            >
              <Plus className="size-3.5" />
            </Button>
          </PermissionGuard>
           <PermissionGuard permission="stages.update">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEditMinistry(ministry)}
              aria-label={t("form.editTitle")}
            >
              <Edit className="size-3.5" />
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="stages.delete">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDeactivateMinistry(ministry)}
              aria-label={t("delete.title")}
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {expanded && (
        <div className="border-t">
          {stages.length > 0 ? (
            stages.map((stage) => (
              <StageRow
                key={stage.id}
                stage={stage}
                onEdit={onEditStage}
                onDeactivate={onDeactivateStage}
                onAssignUsers={onAssignUsers}
              />
            ))
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t("noStages")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
