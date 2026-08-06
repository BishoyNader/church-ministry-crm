"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, Plus, SearchX } from "lucide-react";
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
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { ErrorState } from "@/components/feedback/error-state";
import { PermissionGuard } from "@/features/rbac";
import { Link, useRouter } from "@/i18n/navigation";
import {
  useChurchList,
  useChurchesSummary,
} from "../hooks/use-churches";
import { ChurchFormDialog } from "./church-form-dialog";
import { ChurchQuickStats } from "./church-quick-stats";
import { ChurchStatusBadge } from "./church-status-badge";
import { ChurchActionsMenu } from "./church-actions-menu";
import { ChurchStatusConfirmDialog } from "./church-status-confirm-dialog";
import { ChangeChurchManagerDialog } from "./change-church-manager-dialog";
import type { ChurchListItem, ChurchStatus, ChurchStatusFilter } from "../types/church.types";

const PAGE_SIZE = 20;

type CountCellProps = {
  label: string;
  value: number;
};

function CountCell({ label, value }: CountCellProps) {
  return (
    <div className="flex min-w-[72px] flex-col items-center rounded-lg bg-muted/40 px-2 py-1.5">
      <span className="text-sm font-semibold">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

export function ChurchesPage() {
  const t = useTranslations("churches");
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ChurchStatusFilter>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editChurch, setEditChurch] = useState<ChurchListItem | null>(null);
  const [statusChurch, setStatusChurch] = useState<ChurchListItem | null>(null);
  const [statusTarget, setStatusTarget] = useState<ChurchStatus>("inactive");
  const [managerChurch, setManagerChurch] = useState<ChurchListItem | null>(null);

  const { data: summaryData, isLoading: summaryLoading } = useChurchesSummary();

  const filters = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      status: statusFilter,
    }),
    [page, search, statusFilter],
  );

  const { data, isLoading, error } = useChurchList(filters);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const rows = data?.data?.rows ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 0;

  const hasActiveFilters = search || statusFilter !== "all";

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("all");
    setPage(1);
  };

  const handleStatusChange = (value: unknown) => {
    setStatusFilter(value as ChurchStatusFilter);
    setPage(1);
  };

  const handleStatusSelect = (church: ChurchListItem, status: ChurchStatus) => {
    setStatusChurch(church);
    setStatusTarget(status);
  };

  const handleView = (church: ChurchListItem) => {
    router.push(`/admin/churches/${church.id}`);
  };

  const handleViewAudit = (church: ChurchListItem) => {
    router.push(`/admin/churches/${church.id}?tab=audit`);
  };

  if (error) {
    return <ErrorState title={t("errors.listFailed")} message={error.message} />;
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <PermissionGuard permission="tenants.create">
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/admin/churches/create">
                <Button type="button" variant="outline">
                  {t("provisionChurch")}
                </Button>
              </Link>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                {t("addChurch")}
              </Button>
            </div>
          </PermissionGuard>
        }
      />

      <ChurchQuickStats
        summary={summaryData?.data}
        isLoading={summaryLoading}
        activeFilter={statusFilter}
        onSelectStatus={(status) => {
          setStatusFilter(status);
          setPage(1);
        }}
      />

      <SectionCard className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <Input
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="sm:max-w-xs"
          />

          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="sm:max-w-[180px]">
              <SelectValue placeholder={t("statusFilterPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("statusAll")}</SelectItem>
              <SelectItem value="active">{t("statusActive")}</SelectItem>
              <SelectItem value="inactive">{t("statusInactive")}</SelectItem>
              <SelectItem value="suspended">{t("statusSuspended")}</SelectItem>
              <SelectItem value="disabled">{t("statusDisabled")}</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} className="sm:ml-auto">
              <SearchX className="size-4" />
              {t("clearFilters")}
            </Button>
          )}
        </div>
      </SectionCard>

      <SectionCard>
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 px-4 py-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Building2 className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
          </div>
        ) : (
          <div className="divide-y">
            {rows.map((church) => (
              <div key={church.id} className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-1">
                  <button
                    type="button"
                    onClick={() => handleView(church)}
                    className="text-left font-medium hover:underline"
                  >
                    {church.name_ar}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {church.slug} · {church.contact_email ?? "—"}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {t("manager.label")}:{" "}
                      {church.manager ? church.manager.fullNameAr : t("manager.notAssigned")}
                    </span>
                    <span>·</span>
                    <span>{t("createdAt")}: {new Date(church.created_at).toLocaleDateString()}</span>
                    <span>·</span>
                    <span>
                      {t("lastActivity")}:{" "}
                      {church.lastActivityAt ? new Date(church.lastActivityAt).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <CountCell label={t("counts.members")} value={church.memberCount} />
                  <CountCell label={t("counts.servants")} value={church.servantCount} />
                  <CountCell label={t("counts.children")} value={church.childCount} />
                  <CountCell label={t("counts.services")} value={church.serviceCount} />
                  <CountCell label={t("counts.stages")} value={church.stageCount} />
                  <CountCell label={t("counts.classes")} value={church.classCount} />
                </div>

                <div className="flex items-center gap-2">
                  <ChurchStatusBadge status={church.status} />
                  <ChurchActionsMenu
                    church={church}
                    onView={handleView}
                    onEdit={setEditChurch}
                    onStatusChange={handleStatusSelect}
                    onChangeManager={setManagerChurch}
                    onViewAudit={handleViewAudit}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("paginationLabel", { total, page, totalPages })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              {t("previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
            >
              {t("next")}
            </Button>
          </div>
        </div>
      )}

      <ChurchFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <ChurchFormDialog
        open={!!editChurch}
        onOpenChange={(open) => {
          if (!open) setEditChurch(null);
        }}
        church={editChurch}
      />

      <ChurchStatusConfirmDialog
        open={!!statusChurch}
        onOpenChange={(open) => {
          if (!open) setStatusChurch(null);
        }}
        churchId={statusChurch?.id ?? ""}
        status={statusTarget}
      />

      <ChangeChurchManagerDialog
        open={!!managerChurch}
        onOpenChange={(open) => {
          if (!open) setManagerChurch(null);
        }}
        churchId={managerChurch?.id ?? ""}
        currentManagerId={managerChurch?.manager?.userId}
      />
    </section>
  );
}
