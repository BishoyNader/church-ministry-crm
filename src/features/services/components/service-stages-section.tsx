"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGuard } from "@/features/rbac";
import { useStageList } from "@/features/stages/hooks/use-stages";
import { StageFormDialog } from "@/features/stages/components/stage-form-dialog";
import { StageDeleteDialog } from "@/features/stages/components/stage-delete-dialog";
import { StageRow } from "@/features/stages/components/stage-row";
import type { StageListItem } from "@/features/stages/types/stage.types";
import { SERVICES_QUERY_KEYS } from "../hooks/use-services";

type ServiceStagesSectionProps = {
  serviceId: string;
};

export function ServiceStagesSection({ serviceId }: ServiceStagesSectionProps) {
  const tServices = useTranslations("services");
  const tMinistry = useTranslations("stages.ministry");
  const queryClient = useQueryClient();

  const [expanded, setExpanded] = useState(true);
  const [createStageOpen, setCreateStageOpen] = useState(false);
  const [editStage, setEditStage] = useState<StageListItem | null>(null);
  const [deleteStage, setDeleteStage] = useState<StageListItem | null>(null);

  const stagesQuery = useStageList(serviceId);
  const stages = stagesQuery.data?.data ?? [];

  const refreshServices = () => {
    queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEYS.all });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-2 text-sm font-semibold"
          aria-expanded={expanded}
          aria-label={tMinistry("toggleStages")}
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          {tServices("table.stages")}
          <span className="text-xs font-normal text-muted-foreground">
            {tMinistry("stagesCount", { count: stages.length })}
          </span>
        </button>

        <PermissionGuard permission="stages.create">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCreateStageOpen(true)}
          >
            <Plus className="size-3.5" />
            {tMinistry("addStage")}
          </Button>
        </PermissionGuard>
      </div>

      {expanded && (
        <div className="rounded-xl border bg-muted/30">
          {stagesQuery.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : stages.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {tMinistry("noStages")}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {stages.map((stage) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  onEdit={setEditStage}
                  onDeactivate={setDeleteStage}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {createStageOpen && (
        <StageFormDialog
          open={createStageOpen}
          onOpenChange={setCreateStageOpen}
          ministryId={serviceId}
          onSuccess={refreshServices}
        />
      )}

      {editStage && (
        <StageFormDialog
          open={!!editStage}
          onOpenChange={(open) => {
            if (!open) setEditStage(null);
          }}
          ministryId={serviceId}
          stage={editStage}
          onSuccess={refreshServices}
        />
      )}

      {deleteStage && (
        <StageDeleteDialog
          open={!!deleteStage}
          onOpenChange={(open) => {
            if (!open) setDeleteStage(null);
          }}
          stage={deleteStage}
          onSuccess={refreshServices}
        />
      )}
    </div>
  );
}
