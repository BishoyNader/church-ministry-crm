"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PaginationBar } from "@/components/layout/pagination-bar";
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
import { useChildList, useChildServices, useChildStages } from "../hooks/use-children";
import { ChildTable } from "./child-table";
import { ChildEmptyState } from "./child-empty-state";
import { ChildFormDialog } from "./child-form-dialog";
import { ChildDeleteDialog } from "./child-delete-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { ErrorState } from "@/components/feedback/error-state";
import { BeneficiaryBulkPanel } from "@/features/import-export/components/beneficiary-bulk-panel";
import type { ChildListItem } from "../types/child.types";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "all", labelKey: "filters.allStatuses" },
  { value: "active", labelKey: "status.active" },
  { value: "inactive", labelKey: "status.inactive" },
  { value: "transferred", labelKey: "status.transferred" },
  { value: "graduated", labelKey: "status.graduated" },
] as const;



export function ChildListPage() {
  const t = useTranslations("children");

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const search = useDebouncedValue(searchInput, 300);

  const [createOpen, setCreateOpen] = useState(false);
  const [editChild, setEditChild] = useState<ChildListItem | null>(null);
  const [deleteChild, setDeleteChild] = useState<ChildListItem | null>(null);

  const servicesQuery = useChildServices();
  const services = servicesQuery.data?.data ?? [];

  const serviceId = serviceFilter !== "all" ? serviceFilter : undefined;
  const stagesQuery = useChildStages(serviceId);
  const stages = stagesQuery.data?.data ?? [];

  const { data, isLoading, error } = useChildList(
    {
      search: search || undefined,
      service_id: serviceFilter !== "all" ? serviceFilter : undefined,
      stage_id: stageFilter !== "all" ? stageFilter : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
    },
    { page, pageSize: PAGE_SIZE },
  );

  const children = data?.data?.data ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 0;

  const handleServiceChange = (value: unknown) => {
    setServiceFilter(value as string);
    setStageFilter("all");
    setPage(1);
  };

  const handleFilterChange = (setter: (value: string) => void) => (value: unknown) => {
    setter(value as string);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput("");
    setServiceFilter("all");
    setStageFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  const hasActiveFilters =
    search || serviceFilter !== "all" || stageFilter !== "all" ||
    statusFilter !== "all";

  if (error) {
    return (
      <ErrorState title={t("errors.listFailed")} message={error.message} />
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <PermissionGuard permission="beneficiaries.create">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              {t("addChild")}
            </Button>
          </PermissionGuard>
        }
      />

      <BeneficiaryBulkPanel
        filters={{
          search: search || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          service_id: serviceFilter !== "all" ? serviceFilter : undefined,
          stage_id: stageFilter !== "all" ? stageFilter : undefined,
        }}
      />

      <SectionCard className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <Input
            placeholder={t("searchPlaceholder")}
            aria-label={t("search")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 min-w-[200px]"
          />

          <Select
            value={serviceFilter}
            onValueChange={handleServiceChange}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t("filters.allServices")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allServices")}</SelectItem>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name_ar}
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

      <PaginationBar
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

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
