"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Archive, ArchiveRestore, CalendarDays, Pencil, Plus, RotateCcw, SearchX } from "lucide-react";
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
import { Link } from "@/i18n/navigation";
import { useServiceList, useRestoreService } from "../hooks/use-services";
import { ServiceFormDialog } from "./service-form-dialog";
import { DeleteServiceDialog } from "./delete-service-dialog";
import { ACADEMIC_PRESETS } from "../constants/presets";
import type { ServiceListItem, ServiceStatusFilter } from "../types/services.types";

const PAGE_SIZE = 20;

export function ServicesPage() {
  const t = useTranslations("services");

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editService, setEditService] = useState<ServiceListItem | null>(null);
  const [archiveService, setArchiveService] = useState<ServiceListItem | null>(null);

  const restoreMutation = useRestoreService();

  const filters = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      status: statusFilter,
    }),
    [page, search, statusFilter],
  );

  const { data, isLoading, error } = useServiceList(filters);

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
    setStatusFilter(value as ServiceStatusFilter);
    setPage(1);
  };

  const handleRestore = async (service: ServiceListItem) => {
    try {
      await restoreMutation.mutateAsync(service.id);
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
          <PermissionGuard permission="stages.create">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              {t("addService")}
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
                  <th scope="col" className="px-4 py-3">{t("table.stages")}</th>
                  <th scope="col" className="px-4 py-3">{t("table.events")}</th>
                  <th scope="col" className="px-4 py-3">{t("table.status")}</th>
                  <th scope="col" className="px-4 py-3">{t("table.sortOrder")}</th>
                  <th scope="col" className="px-4 py-3 text-end">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((service) => (
                  <tr key={service.id} className="align-middle">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{service.name_ar}</p>
                        {service.service_type &&
                        service.service_type in ACADEMIC_PRESETS ? (
                          <Badge variant="outline" className="text-xs">
                            {ACADEMIC_PRESETS[
                              service.service_type as keyof typeof ACADEMIC_PRESETS
                            ].name_ar}
                          </Badge>
                        ) : null}
                      </div>
                      {service.name_en ? (
                        <p className="text-xs text-muted-foreground">{service.name_en}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t("table.stageCount", { count: service.stageCount })}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={{ pathname: "/events", query: { serviceId: service.id } }}
                        className="inline-flex items-center gap-1.5 font-medium text-ministry hover:underline"
                        aria-label={t("table.viewEvents")}
                      >
                        <CalendarDays className="size-3.5" />
                        {t("table.eventCount", { count: service.eventCount })}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={service.is_active ? "default" : "secondary"}>
                        {service.is_active ? t("status.active") : t("status.inactive")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{service.sort_order}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <PermissionGuard permission="stages.update">
                          {service.is_active ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("table.archive")}
                              onClick={() => setArchiveService(service)}
                            >
                              <Archive className="size-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("table.restore")}
                              disabled={restoreMutation.isPending}
                              onClick={() => handleRestore(service)}
                            >
                              <ArchiveRestore className="size-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("table.edit")}
                            onClick={() => setEditService(service)}
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
        <ServiceFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}

      {editService && (
        <ServiceFormDialog
          open={!!editService}
          onOpenChange={(open) => {
            if (!open) setEditService(null);
          }}
          service={editService}
        />
      )}

      {archiveService && (
        <DeleteServiceDialog
          open={!!archiveService}
          onOpenChange={(open) => {
            if (!open) setArchiveService(null);
          }}
          service={archiveService}
        />
      )}
    </section>
  );
}
