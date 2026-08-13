"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CheckCircle2,
  XCircle,
  Mail,
  Search,
  SearchX,
  UserRound,
  CalendarDays,
} from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StaggerItem, StaggerList } from "@/components/motion/motion-primitives";
import { formatLocalizedDate, formatLocalizedDateTime } from "@/lib/dates";
import {
  useApproveChurchRequest,
  useChurchRequests,
} from "../hooks/use-church-requests";
import type { ChurchRequestRow, ChurchRequestStatus } from "../types/church-request.admin.types";
import { ApprovalResultDialog, type ApprovalResult } from "./approval-result-dialog";
import { RejectChurchRequestDialog } from "./reject-church-request-dialog";

const STATUS_TABS: ChurchRequestStatus[] = ["pending", "approved", "rejected"];

type AdminChurchRequestsPageProps = {
  embedded?: boolean;
};

export function AdminChurchRequestsPage({ embedded = false }: AdminChurchRequestsPageProps) {
  const t = useTranslations("admin.churchRequests");
  const locale = useLocale();

  const [tab, setTab] = useState<ChurchRequestStatus>("pending");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 250);
  const [rejectTarget, setRejectTarget] = useState<ChurchRequestRow | null>(null);
  const [result, setResult] = useState<ApprovalResult>(null);

  const { data, isLoading, error } = useChurchRequests(tab);
  const approve = useApproveChurchRequest();

  const rows = useMemo(() => {
    const all = data?.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter((row) =>
      [row.church_name_ar, row.applicant_name, row.catechist_name, row.email]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }, [data, search]);

  const handleApprove = async (request: ChurchRequestRow) => {
    try {
      const res = await approve.mutateAsync(request.id);
      setResult({
        type: res.success ? "success" : "error",
        requestName: request.church_name_ar,
        inviteLink: res.data?.inviteLink ?? null,
        message: res.success ? undefined : res.message,
      });
    } catch (approveError) {
      setResult({
        type: "error",
        requestName: request.church_name_ar,
        inviteLink: null,
        message: approveError instanceof Error ? approveError.message : undefined,
      });
    }
  };

  const clearSearch = () => setSearchInput("");

  return (
    <section className="space-y-6">
      {!embedded ? (
        <PageHeader title={t("title")} description={t("description")} />
      ) : null}

      <Tabs value={tab} onValueChange={(value) => setTab(value as ChurchRequestStatus)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            {STATUS_TABS.map((status) => (
              <TabsTrigger key={status} value={status}>
                {t(`tabs.${status}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="relative">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchLabel")}
              className="ps-9 pe-9 sm:max-w-xs"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={clearSearch}
                aria-label={t("searchLabel")}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <SearchX className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
      </Tabs>

      <SectionCard>
        {error ? (
          <ErrorState title={t("errors.listFailed")} message={error.message} />
        ) : isLoading ? (
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
          <EmptyState
            icon={<UserRound className="size-6" />}
            title={search ? t("empty.searchTitle") : t("empty.title")}
            description={search ? t("empty.searchDescription") : t("empty.description")}
          />
        ) : (
          <div className="divide-y">
            <StaggerList stagger={0.05}>
              {rows.map((request) => (
                <StaggerItem key={request.id}>
                  <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{request.church_name_ar}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("table.catechist", { name: request.catechist_name })} ·{" "}
                        {t("table.submitted", {
                          date: formatLocalizedDate(request.created_at, locale),
                        })}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="size-3" />
                          {request.applicant_name}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Mail className="size-3" />
                          {request.email}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3" />
                          {formatLocalizedDateTime(request.created_at, locale)}
                        </span>
                      </div>
                      {request.notes ? (
                        <p className="text-xs text-muted-foreground">
                          {t("table.notes")}: {request.notes}
                        </p>
                      ) : null}
                      {tab !== "pending" && request.decision_notes ? (
                        <p className="text-xs text-muted-foreground">
                          {t("table.reason", { reason: request.decision_notes })}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      {tab === "pending" ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setRejectTarget(request)}
                            disabled={approve.isPending}
                          >
                            <XCircle className="size-4" />
                            {t("reject")}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handleApprove(request)}
                            disabled={approve.isPending}
                          >
                            <CheckCircle2 className="size-4" />
                            {approve.isPending ? t("rejectDialog.processing") : t("approve")}
                          </Button>
                        </>
                      ) : (
                        <Badge variant={tab === "approved" ? "default" : "destructive"}>
                          {t(`tabs.${tab}`)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerList>
          </div>
        )}
      </SectionCard>

      {!isLoading && !error && rows.length > 0 ? (
        <p className="text-sm text-muted-foreground">{t("resultsCount", { count: rows.length })}</p>
      ) : null}

      <RejectChurchRequestDialog
        request={rejectTarget}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
      />

      <ApprovalResultDialog
        result={result}
        onOpenChange={(open) => {
          if (!open) setResult(null);
        }}
      />
    </section>
  );
}
