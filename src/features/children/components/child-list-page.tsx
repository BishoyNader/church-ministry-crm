"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Plus } from "lucide-react";
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [pipelineFilter, setPipelineFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [editChild, setEditChild] = useState<ChildListItem | null>(null);
  const [deleteChild, setDeleteChild] = useState<ChildListItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const ministriesQuery = useChildMinistries();
  const ministries = ministriesQuery.data?.data ?? [];
  const firstMinistryId = ministries[0]?.id;
  const stagesQuery = useChildStages(firstMinistryId);
  const stages = stagesQuery.data?.data ?? [];

  const { data, isLoading } = useChildList(
    {
      search: search || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      pipeline_stage: pipelineFilter !== "all" ? pipelineFilter : undefined,
      stage_id: stageFilter !== "all" ? stageFilter : undefined,
    },
    { page, pageSize: PAGE_SIZE },
  );

  const children = data?.data?.data ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 0;

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleStatusChange = (value: unknown) => {
    setStatusFilter(value as string);
    setPage(1);
  };

  const handlePipelineChange = (value: unknown) => {
    setPipelineFilter(value as string);
    setPage(1);
  };

  const handleStageChange = (value: unknown) => {
    setStageFilter(value as string);
    setPage(1);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <PermissionGuard permission="children.create">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("addChild")}
          </Button>
        </PermissionGuard>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={handleSearch}>
            {t("search")}
          </Button>
          <Select value={stageFilter} onValueChange={handleStageChange}>
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
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full sm:w-44">
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
          <Select value={pipelineFilter} onValueChange={handlePipelineChange}>
            <SelectTrigger className="w-full sm:w-48">
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
        </div>
      </div>

      {isLoading || children.length > 0 ? (
        <ChildTable
          children_={children}
          isLoading={isLoading}
          onEdit={setEditChild}
          onDelete={setDeleteChild}
        />
      ) : (
        <ChildEmptyState />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 shadow-sm">
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
        </div>
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
          child={editChild as unknown as import("../types/child.types").ChildDetail}
        />
      )}

      <ChildDeleteDialog
        open={!!deleteChild}
        onOpenChange={(open) => {
          if (!open) setDeleteChild(null);
        }}
        child={deleteChild}
      />
    </section>
  );
}
