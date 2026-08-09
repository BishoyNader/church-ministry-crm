"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Download, Eye, RotateCcw, SearchX } from "lucide-react";
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
import { useAuditFilterOptions, useAuditPage, useExportAuditCsv } from "../hooks/use-audit";
import { AUDIT_ACTION_CODES } from "../services/audit.service";
import { AuditDetailDialog } from "./audit-detail-dialog";
import type { AuditFilters, AuditLogEntry } from "../types/audit.types";

const PAGE_SIZE = 20;

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
  import: "secondary",
  export: "secondary",
  login: "outline",
  logout: "outline",
  read: "outline",
  cron: "outline",
};

export function AuditPage() {
  const t = useTranslations("audit");
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  const filters: AuditFilters = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      action: actionFilter !== "all" ? actionFilter : undefined,
      entityType: entityFilter !== "all" ? entityFilter : undefined,
      actorId: actorFilter !== "all" ? actorFilter : undefined,
      search: search || undefined,
    }),
    [page, fromDate, toDate, actionFilter, entityFilter, actorFilter, search],
  );

  const { data, isLoading, error } = useAuditPage(filters);
  const { data: filterOptions } = useAuditFilterOptions();
  const exportMutation = useExportAuditCsv();

  const rows = data?.data?.rows ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 0;

  const entityOptions = filterOptions?.data?.entityTypes ?? [];
  const actorOptions = filterOptions?.data?.actors ?? [];

  const hasActiveFilters =
    fromDate || toDate || actionFilter !== "all" || entityFilter !== "all" ||
    actorFilter !== "all" || search;

  const handleFilterChange = (setter: (value: string) => void) => (value: unknown) => {
    setter(value as string);
    setPage(1);
  };

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setActionFilter("all");
    setEntityFilter("all");
    setActorFilter("all");
    setSearchInput("");
    setPage(1);
  };

  const handleExport = async () => {
    try {
      const result = await exportMutation.mutateAsync(filters);
      if (!result.success || !result.data) return;

      const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      // Error is surfaced via exportMutation.error state below
    }
  };

  if (error) {
    return <ErrorState title={t("loadFailed")} message={error.message} />;
  }

  const exportError = exportMutation.error?.message ?? null;

  return (
    <section className="space-y-6">
      {exportError ? (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {exportError}
        </div>
      ) : null}

      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button variant="outline" className="gap-2" onClick={handleExport} disabled={exportMutation.isPending}>
            <Download className="size-4" />
            {exportMutation.isPending ? t("exporting") : t("export")}
          </Button>
        }
      />

      <SectionCard className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:flex-wrap">
          <Input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            aria-label={t("filters.from")}
            className="w-full lg:w-44"
          />
          <Input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            aria-label={t("filters.to")}
            className="w-full lg:w-44"
          />
          <Select value={actionFilter} onValueChange={handleFilterChange(setActionFilter)}>
            <SelectTrigger className="w-full lg:w-40">
              <SelectValue placeholder={t("filters.allActions")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allActions")}</SelectItem>
              {AUDIT_ACTION_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {t(`actions.${code}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={handleFilterChange(setEntityFilter)}>
            <SelectTrigger className="w-full lg:w-44">
              <SelectValue placeholder={t("filters.allEntityTypes")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allEntityTypes")}</SelectItem>
              {entityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(`entityTypes.${option.value}`, { defaultValue: option.label })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actorFilter} onValueChange={handleFilterChange(setActorFilter)}>
            <SelectTrigger className="w-full lg:w-44">
              <SelectValue placeholder={t("filters.allActors")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allActors")}</SelectItem>
              {actorOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-full lg:flex-1 lg:min-w-[220px]"
          />
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
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl" />
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
                  <th scope="col" className="px-4 py-3">{t("table.time")}</th>
                  <th scope="col" className="px-4 py-3">{t("table.action")}</th>
                  <th scope="col" className="px-4 py-3">{t("table.entityType")}</th>
                  <th scope="col" className="px-4 py-3">{t("table.entityId")}</th>
                  <th scope="col" className="px-4 py-3">{t("table.actor")}</th>
                  <th scope="col" className="px-4 py-3 text-end">{t("table.details")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((entry) => (
                  <tr key={entry.id} className="align-middle">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString(locale)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={ACTION_VARIANT[entry.action] ?? "outline"}>
                        {t(`actions.${entry.action}`, { defaultValue: entry.action })}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {t(`entityTypes.${entry.entityType}`, { defaultValue: entry.entityType })}
                    </td>
                    <td className="max-w-[180px] px-4 py-3 font-mono text-xs truncate" title={entry.entityId}>
                      {entry.entityId}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3">
                      {entry.actorName ?? entry.actorEmail ?? entry.actorId ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("table.viewDetails")}
                        onClick={() => setSelectedEntry(entry)}
                      >
                        <Eye className="size-4" />
                      </Button>
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

      {selectedEntry && (
        <AuditDetailDialog
          entry={selectedEntry}
          open={!!selectedEntry}
          onOpenChange={(open) => {
            if (!open) setSelectedEntry(null);
          }}
        />
      )}
    </section>
  );
}
