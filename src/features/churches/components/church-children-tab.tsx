"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/layout/section-card";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { BeneficiaryBulkPanel } from "@/features/import-export/components/beneficiary-bulk-panel";
import { useChurchChildren } from "../hooks/use-children";
import { useChurchServices, useChurchStages } from "../hooks/use-churches";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 20;

type ChurchChildrenTabProps = {
  churchId: string;
};

const STATUS_OPTIONS = [
  { value: "all", labelKey: "filters.allStatuses" },
  { value: "active", labelKey: "status.active" },
  { value: "inactive", labelKey: "status.inactive" },
  { value: "transferred", labelKey: "status.transferred" },
  { value: "graduated", labelKey: "status.graduated" },
] as const;

export function ChurchChildrenTab({ churchId }: ChurchChildrenTabProps) {
  const t = useTranslations("children");
  const ct = useTranslations("churches");

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const servicesQuery = useChurchServices(churchId);
  const services = servicesQuery.data?.data ?? [];

  const serviceId = serviceFilter !== "all" ? serviceFilter : undefined;
  const stagesQuery = useChurchStages(churchId);
  const stages = stagesQuery.data?.data ?? [];

  const { data, isLoading, error } = useChurchChildren(churchId, {
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    service_id: serviceFilter !== "all" ? serviceFilter : undefined,
    stage_id: stageFilter !== "all" ? stageFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const children = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

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
    setSearch("");
    setServiceFilter("all");
    setStageFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  const hasActiveFilters = search || serviceFilter !== "all" || stageFilter !== "all" || statusFilter !== "all";

  if (error) {
    return (
      <SectionCard>
        <div className="py-10 text-center text-destructive">
          {t("errors.listFailed")}
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard>
        <div className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            <div className="flex flex-1 items-center gap-2 min-w-[200px]">
              <Input
                placeholder={t("searchPlaceholder")}
                aria-label={t("search")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleSearch}>
                {t("search")}
              </Button>
            </div>

            <Select value={serviceFilter} onValueChange={handleServiceChange}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder={t("filters.allServices")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.allServices")}</SelectItem>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nameAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={stageFilter} onValueChange={handleFilterChange(setStageFilter)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder={t("filters.allStages")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.allStages")}</SelectItem>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nameAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
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
        </div>
      </SectionCard>

      <BeneficiaryBulkPanel
        churchId={churchId}
        filters={{
          search: search || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          service_id: serviceFilter !== "all" ? serviceFilter : undefined,
          stage_id: stageFilter !== "all" ? stageFilter : undefined,
        }}
      />

      <SectionCard>
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16 ms-auto" />
              </div>
            ))}
          </div>
        ) : children.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <SearchX className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{ct("counts.children")}</p>
          </div>
        ) : (
          <div className="divide-y">
            <div className="hidden px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:flex">
              <span className="flex-1">{t("table.name")}</span>
              <span className="w-28">{t("table.stage")}</span>
              <span className="w-24">{t("table.status")}</span>
            </div>
            {children.map((child) => (
              <div
                key={child.id}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="font-medium flex-1">{child.full_name_ar}</span>
                <span className="text-sm text-muted-foreground w-28">
                  {child.stageNameAr || "—"}
                </span>
                <span className="w-24">
                  <Badge
                    variant={child.status === "active" ? "default" : "secondary"}
                  >
                    {t(`status.${child.status}`)}
                  </Badge>
                </span>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="border-t px-0">
            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}