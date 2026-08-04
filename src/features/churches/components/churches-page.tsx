"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, SearchX, UserCheck, UserX } from "lucide-react";
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
import { useChurchList, useActivateChurch, useDeactivateChurch } from "../hooks/use-churches";
import { ChurchFormDialog } from "./church-form-dialog";
import type { ChurchListItem, ChurchFilters } from "../types/church.types";

const PAGE_SIZE = 20;

export function ChurchesPage() {
  const t = useTranslations("churches");

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ChurchFilters["status"]>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editChurch, setEditChurch] = useState<ChurchListItem | null>(null);

  const activateMutation = useActivateChurch();
  const deactivateMutation = useDeactivateChurch();

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
    setStatusFilter(value as ChurchFilters["status"]);
    setPage(1);
  };

  const handleActivate = async (church: ChurchListItem) => {
    try {
      await activateMutation.mutateAsync(church.id);
    } catch {
      // Error is surfaced via activateMutation.error state below
    }
  };

  const handleDeactivate = async (church: ChurchListItem) => {
    try {
      await deactivateMutation.mutateAsync(church.id);
    } catch {
      // Error is surfaced via deactivateMutation.error state below
    }
  };

  if (error) {
    return <ErrorState title={t("errors.listFailed")} message={error.message} />;
  }

  const activateError = activateMutation.error?.message ?? null;
  const deactivateError = deactivateMutation.error?.message ?? null;

  return (
    <section className="space-y-6">
      {(activateError || deactivateError) && (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {activateError || deactivateError}
        </div>
      )}

      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <PermissionGuard permission="tenants.create">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              {t("addChurch")}
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
              <div key={index} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <SearchX className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
          </div>
        ) : (
          <div className="divide-y">
            {rows.map((church) => (
              <div key={church.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{church.name_ar}</p>
                  <p className="text-xs text-muted-foreground">
                    {church.slug} · {church.contact_email ?? "—"} · {church.contact_phone ?? "—"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(church.created_at).toLocaleDateString()}</span>
                    <span>·</span>
                    <span>{church.subscription_tier}</span>
                    <span>·</span>
                    <Badge variant={church.is_active ? "default" : "secondary"}>
                      {church.is_active ? t("statusActive") : t("statusInactive")}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <PermissionGuard permission="tenants.update">
                    {church.is_active ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeactivate(church)}
                        disabled={deactivateMutation.isPending}
                        aria-label={t("deactivate")}
                      >
                        <UserX className="size-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleActivate(church)}
                        disabled={activateMutation.isPending}
                        aria-label={t("activate")}
                      >
                        <UserCheck className="size-4" />
                      </Button>
                    )}
                  </PermissionGuard>
                  <PermissionGuard permission="tenants.update">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditChurch(church)}
                      aria-label={t("edit")}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </PermissionGuard>
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
    </section>
  );
}