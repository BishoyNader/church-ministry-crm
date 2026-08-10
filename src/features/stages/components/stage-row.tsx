"use client";

import { useTranslations } from "next-intl";
import { Users, Edit, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PermissionGuard } from "@/features/rbac";
import type { StageListItem } from "../types/stage.types";

type StageRowProps = {
  stage: StageListItem;
  onEdit: (stage: StageListItem) => void;
  onDeactivate: (stage: StageListItem) => void;
  onAssignUsers?: (stage: StageListItem) => void;
};

export function StageRow({
  stage,
  onEdit,
  onDeactivate,
  onAssignUsers,
}: StageRowProps) {
  const t = useTranslations("stages.stage");

  const ageRange =
    stage.age_min != null || stage.age_max != null
      ? `${stage.age_min ?? "—"} – ${stage.age_max ?? "—"}`
      : null;

  return (
    <div className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0 transition hover:bg-muted/30">
      <div className="flex flex-1 items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{stage.name_ar}</p>
            {!stage.is_active && (
              <Badge variant="destructive" className="text-[10px]">
                {t("status.inactive")}
              </Badge>
            )}
          </div>
          {stage.name_en && (
            <p className="text-xs text-muted-foreground truncate">
              {stage.name_en}
            </p>
          )}
        </div>

        {ageRange && (
          <span className="hidden text-xs text-muted-foreground sm:inline whitespace-nowrap">
            {t("status.age")}: {ageRange}
          </span>
        )}

        <div className="hidden items-center gap-3 text-xs text-muted-foreground md:flex">
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            {t("childrenCount", { count: stage.childrenCount })}
          </span>
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            {t("usersCount", { count: stage.usersCount })}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
         {onAssignUsers && (
          <PermissionGuard permission="servants.assign">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onAssignUsers(stage)}
              aria-label={t("assignUsers")}
            >
              <UserPlus className="size-3.5" />
            </Button>
          </PermissionGuard>
        )}
        <PermissionGuard permission="stages.update">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(stage)}
            aria-label={t("editFormTitle")}
          >
            <Edit className="size-3.5" />
          </Button>
        </PermissionGuard>
        <PermissionGuard permission="stages.delete">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDeactivate(stage)}
            aria-label={t("deactivate")}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </PermissionGuard>
      </div>
    </div>
  );
}
