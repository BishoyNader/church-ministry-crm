"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { ErrorState } from "@/components/feedback/error-state";
import { PermissionGuard, useIsStageScoped } from "@/features/rbac";
import { useMinistryList } from "../hooks/use-ministries";
import { useStageList } from "../hooks/use-stages";
import { MinistryCard } from "./ministry-card";
import { StageEmptyState } from "./stage-empty-state";
import { MinistryFormDialog } from "./ministry-form-dialog";
import { StageFormDialog } from "./stage-form-dialog";
import { MinistryDeleteDialog } from "./ministry-delete-dialog";
import { StageDeleteDialog } from "./stage-delete-dialog";
import { StageUserAssignmentDialog } from "./stage-user-assignment-dialog";
import type { MinistryListItem, StageListItem } from "../types/stage.types";

export function StageManagementPage() {
  const t = useTranslations("stages");

  const [createMinistryOpen, setCreateMinistryOpen] = useState(false);
  const [editMinistry, setEditMinistry] = useState<MinistryListItem | null>(null);
  const [deleteMinistry, setDeleteMinistry] = useState<MinistryListItem | null>(null);

  const [createStageMinistryId, setCreateStageMinistryId] = useState<string | null>(null);
  const [editStage, setEditStage] = useState<StageListItem | null>(null);
  const [deleteStage, setDeleteStage] = useState<StageListItem | null>(null);
  const [assignUsersStage, setAssignUsersStage] = useState<StageListItem | null>(null);

  const ministriesQuery = useMinistryList();
  const stagesQuery = useStageList();

  const isStageScoped = useIsStageScoped();

  const ministries = ministriesQuery.data?.data ?? [];
  const allStages = stagesQuery.data?.data ?? [];

  const stagesByMinistry = new Map<string, StageListItem[]>();
  for (const stage of allStages) {
    const existing =     stagesByMinistry.get(stage.service_id) ?? [];
    existing.push(stage);
    stagesByMinistry.set(stage.service_id, existing);
  }

  const isLoading = ministriesQuery.isLoading || stagesQuery.isLoading;
  const loadError = ministriesQuery.error ?? stagesQuery.error;

  if (loadError) {
    return (
      <ErrorState title={t("errors.listFailed")} message={loadError.message} />
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <PermissionGuard permission="stages.create">
            <Button onClick={() => setCreateMinistryOpen(true)}>
              <Plus className="size-4" />
              {t("addMinistry")}
            </Button>
          </PermissionGuard>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <SectionCard key={i} className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-16" />
              </div>
            </SectionCard>
          ))}
        </div>
      ) : ministries.length === 0 ? (
        <StageEmptyState scoped={isStageScoped} />
      ) : (
        <div className="space-y-4">
          {ministries.map((ministry) => (
            <MinistryCard
              key={ministry.id}
              ministry={ministry}
              stages={stagesByMinistry.get(ministry.id) ?? []}
              onEditMinistry={setEditMinistry}
              onDeactivateMinistry={setDeleteMinistry}
              onCreateStage={(ministryId) => setCreateStageMinistryId(ministryId)}
              onEditStage={setEditStage}
              onDeactivateStage={setDeleteStage}
              onAssignUsers={setAssignUsersStage}
            />
          ))}
        </div>
      )}

      {createMinistryOpen && (
        <MinistryFormDialog
          open={createMinistryOpen}
          onOpenChange={setCreateMinistryOpen}
        />
      )}

      {editMinistry && (
        <MinistryFormDialog
          open={!!editMinistry}
          onOpenChange={(open) => {
            if (!open) setEditMinistry(null);
          }}
          ministry={editMinistry}
        />
      )}

      {deleteMinistry && (
        <MinistryDeleteDialog
          open={!!deleteMinistry}
          onOpenChange={(open) => {
            if (!open) setDeleteMinistry(null);
          }}
          ministry={deleteMinistry}
        />
      )}

      {createStageMinistryId && (
        <StageFormDialog
          open={!!createStageMinistryId}
          onOpenChange={(open) => {
            if (!open) setCreateStageMinistryId(null);
          }}
          ministryId={createStageMinistryId}
        />
      )}

      {editStage && (
        <StageFormDialog
          open={!!editStage}
          onOpenChange={(open) => {
            if (!open) setEditStage(null);
          }}
          ministryId={editStage.service_id}
          stage={editStage}
        />
      )}

      {deleteStage && (
        <StageDeleteDialog
          open={!!deleteStage}
          onOpenChange={(open) => {
            if (!open) setDeleteStage(null);
          }}
          stage={deleteStage}
        />
      )}

      {assignUsersStage && (
        <StageUserAssignmentDialog
          open={!!assignUsersStage}
          onOpenChange={(open) => {
            if (!open) setAssignUsersStage(null);
          }}
          stage={assignUsersStage}
        />
      )}
    </section>
  );
}
