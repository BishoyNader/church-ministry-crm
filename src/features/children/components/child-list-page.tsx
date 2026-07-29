"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { PermissionGuard } from "@/features/rbac";
import { useChildList, useChildMinistries, useChildStages } from "../hooks/use-children";
import { ChildTable } from "./child-table";
import { ChildEmptyState } from "./child-empty-state";
import { ChildFormDialog } from "./child-form-dialog";
import { ChildDeleteDialog } from "./child-delete-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import type { ChildListItem } from "../types/child.types";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "all", labelKey: "filters.allStatuses" },
  { value: "active", labelKey: "status.active" },
  { value: "inactive", labelKey: "status.inactive" },
  { value: "transferred", labelKey: "status.transferred" },
  { value: "graduated", labelKey: "status.graduated" },
] as const;

const PIPELINE_OPTIONS = [
  { value: "all", labelKey: "filters.allPipeline" },
  { value: "new_visitor", labelKey: "pipeline.new_visitor" },
  { value: "first_followup", labelKey: "pipeline.first_followup" },
  { value: "regular_attendee", labelKey: "pipeline.regular_attendee" },
  { value: "active_member", labelKey: "pipeline.active_member" },
  { value: "leader_candidate", labelKey: "pipeline.leader_candidate" },
] as const;

export function ChildListPage() {
  const t = useTranslations("children");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [ministryFilter, setMinistryFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pipelineFilter, setPipelineFilter] = useState("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editChild, setEditChild] = useState<ChildListItem | null>(null);
  const [deleteChild, setDeleteChild] = useState<ChildListItem | null>(null);

  const ministriesQuery = useChildMinistries();
  const ministries = ministriesQuery.data?.data ?? [];

  const ministryId = ministryFilter !== "all" ? ministryFilter : undefined;
  const stagesQuery = useChildStages(ministryId);
  const stages = stagesQuery.data?.data ?? [];

  const { data, isLoading } = useChildList(
    {
      search: search || undefined,
      ministry_id: ministryFilter !== "all" ? ministryFilter : undefined,
      stage_id: stageFilter !== "all" ? stageFilter : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      pipeline_stage: pipelineFilter !== "all" ? pipelineFilter : undefined,
    },
    { page, pageSize: PAGE_SIZE },
  );

  const children = data?.data?.data ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleMinistryChange = (value: unknown) => {
    setMinistryFilter(value as string);
    setStageFilter("all");
    setPage(1);
  };

  const handleFilterChange = (setter: (value: string) => void) => (value: unknown) => {
    setter(value as string);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setMinistryFilter("all");
    setStageFilter("all");
    setStatusFilter("all");
    setPipelineFilter("all");
    setPage(1);
  };

  const hasActiveFilters =
    search || ministryFilter !== "all" || stageFilter !== "all" ||
    statusFilter !== "all" || pipelineFilter !== "all";

  return (
    <section className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <PermissionGuard permission="children.create">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              {t("addChild")}
            </Button>
          </PermissionGuard>
        }
      />

      <SectionCard className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <Input
            placeholder={t("searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 min-w-[200px]"
          />

          <Select
            value={ministryFilter}
            onValueChange={handleMinistryChange}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t("filters.allMinistries")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allMinistries")}</SelectItem>
              {ministries.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={stageFilter}
            onValueChange={handleFilterChange(setStageFilter)}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t("filters.allStages")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allStages")}</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={handleFilterChange(setStatusFilter)}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder={t("filters.allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={pipelineFilter}
            onValueChange={handleFilterChange(setPipelineFilter)}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t("filters.allPipeline")} />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <RotateCcw className="size-4" />
              {t("filters.clearFilters")}
            </Button>
          )}
        </div>
      </SectionCard>

      {isLoading || children.length > 0 ? (
        <ChildTable
          children_={children}
          isLoading={isLoading}
          onEdit={setEditChild}
          onDelete={setDeleteChild}
        />
      ) : (
        <ChildEmptyState
          title={t("empty.title")}
          description={t("empty.description")}
        />
      )}

      {totalPages > 1 && (
        <SectionCard className="flex items-center justify-between px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {t("pagination.showing", {
              from: (page - 1) * PAGE_SIZE + 1,
              to: Math.min(page * PAGE_SIZE, total),
              total,
            })}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t("pagination.prev")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("pagination.next")}
            </Button>
          </div>
        </SectionCard>
      )}

      {createOpen && (
        <ChildFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      )}

      {editChild && (
        <ChildFormDialog
          open={!!editChild}
          onOpenChange={(open) => {
            if (!open) setEditChild(null);
          }}
          child={editChild}
        />
      )}

      {deleteChild && (
        <ChildDeleteDialog
          open={!!deleteChild}
          onOpenChange={(open) => {
            if (!open) setDeleteChild(null);
          }}
          child={deleteChild}
        />
      )}
    </section>
  );
}
