"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Archive, ArchiveRestore, Pencil, Plus, RotateCcw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { ErrorState } from "@/components/feedback/error-state";
import { PermissionGuard } from "@/features/rbac";
import { useClassList, useRestoreClass } from "../hooks/use-classes";
import { ClassFormDialog } from "./class-form-dialog";
import { DeleteClassDialog } from "./delete-class-dialog";
import type { ClassListItem, ClassStatusFilter } from "../types/classes.types";

const PAGE_SIZE = 20;

export function ClassesPage() {
  const t = useTranslations("classes");

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState<ClassStatusFilter>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editClass, setEditClass] = useState<ClassListItem | null>(null);
  const [archiveClass, setArchiveClass] = useState<ClassListItem | null>(null);

  const restoreMutation = useRestoreClass();

  const filters = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      status: statusFilter,
    }),
    [page, search, statusFilter],
  );

  const { data, isLoading, error } = useClassList(filters);

  const rows = data?.data?.rows ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 0;

  const hasActiveFilters = search || statusFilter !== "all";

  const clearFilters = () => {
    setSearchInput("");
    setStatusFilter("all");
    setPage(1);
  };

  const handleStatusChange = (value: unknown) => {
    setStatusFilter(value as ClassStatusFilter);
    setPage(1);
  };

  const handleRestore = async (classItem: ClassListItem) => {
    try {
      await restoreMutation.mutateAsync(classItem.id);
    } catch {
      // Error is surfaced via restoreMutation.error state below
    }
  };

  if (error) {
    return <ErrorState title={t("errors.listFailed")} message={error.message} />;
  }

  const restoreError = restoreMutation.error?.message ?? null;

  return (
    <section className="space-y-6">
      {restoreError ? (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {restoreError}
        </div>
      ) : null}

      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <PermissionGuard permission="classes.create">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              {t("addClass")}
            </Button>
          </PermissionGuard>
        }
      />

      <SectionCard className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <Input
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="flex-1 min-w-[200px]"
          />

          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t("filters.allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
              <SelectItem value="active">{t("status.active")}</SelectItem>
              <SelectItem value="inactive">{t("status.inactive")}</SelectItem>
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

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <SectionCard className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="rounded-2xl bg-muted p-4 text-muted-foreground">
            <SearchX className="size-8" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-lg font-semibold tracking-tight">{t("empty.title")}</h3>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            {t("empty.description")}
          </p>
        </SectionCard>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t("table.caption")}</caption>
              <thead>
                <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-4 py-3">{t("table.name")}</th>
                  <th scope="col" className="px-4 py-3">{t("table.service")}</th>
                  <th scope="col" className="px-4 py-3">{t("table.stage")}</th>
                  <th scope="col" className="px-4 py-3">{t("table.status")}</th>
                  <th scope="col" className="px-4 py-3">{t("table.sortOrder")}</th>
                  <th scope="col" className="px-4 py-3 text-end">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((classItem) => (
                  <tr key={classItem.id} className="align-middle">
                    <td className="px-4 py-3">
                      <p className="font-medium">{classItem.name_ar}</p>
                      {classItem.name_en ? (
                        <p className="text-xs text-muted-foreground">{classItem.name_en}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {classItem.serviceName || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {classItem.stageName || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={classItem.is_active ? "default" : "secondary"}>
                        {classItem.is_active ? t("status.active") : t("status.inactive")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{classItem.sort_order}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {classItem.is_active ? (
                          <PermissionGuard permission="classes.delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("table.archive")}
                              onClick={() => setArchiveClass(classItem)}
                            >
                              <Archive className="size-4" />
                            </Button>
                          </PermissionGuard>
                        ) : (
                          <PermissionGuard permission="classes.update">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("table.restore")}
                              disabled={restoreMutation.isPending}
                              onClick={() => handleRestore(classItem)}
                            >
                              <ArchiveRestore className="size-4" />
                            </Button>
                          </PermissionGuard>
                        )}
                        <PermissionGuard permission="classes.update">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("table.edit")}
                            onClick={() => setEditClass(classItem)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </PermissionGuard>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      {createOpen && (
        <ClassFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}

      {editClass && (
        <ClassFormDialog
          open={!!editClass}
          onOpenChange={(open) => {
            if (!open) setEditClass(null);
          }}
          classItem={editClass}
        />
      )}

      {archiveClass && (
        <DeleteClassDialog
          open={!!archiveClass}
          onOpenChange={(open) => {
            if (!open) setArchiveClass(null);
          }}
          classItem={archiveClass}
        />
      )}
    </section>
  );
}
