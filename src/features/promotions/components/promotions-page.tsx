"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, Plus, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { cn } from "@/lib/utils";
import { formatLocalizedDate } from "@/lib/dates";
import { PromotionRunDialog } from "./promotion-run-dialog";
import { SinglePromoteDialog } from "./single-promote-dialog";
import { PromotionCycleDashboard } from "./promotion-cycle-dashboard";
import {
  usePromotionRuns,
  usePromotionCycles,
  usePromotionEntries,
  useUndoAllPromotions,
  useUndoPromotion,
} from "../hooks/use-promotions";
import type { AnnualPromotionRun } from "../types/promotions.types";

function RunCard({ run }: { run: AnnualPromotionRun }) {
  const t = useTranslations("promotions");
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);

  const entriesQuery = usePromotionEntries(expanded ? run.id : null);
  const undoAllMutation = useUndoAllPromotions();
  const undoEntryMutation = useUndoPromotion();

  const entries = entriesQuery.data ?? [];
  const pendingEntries = run.totalEntries - run.undoneEntries;
  const isReverted = run.status === "reverted";

  const handleUndoAll = useCallback(() => {
    if (confirm(t("undoAllConfirm", { stage: run.stageName ?? "" }))) {
      undoAllMutation.mutate(run.id);
    }
  }, [t, undoAllMutation, run]);

  const handleUndoEntry = useCallback(
    (entryId: string) => {
      if (confirm(t("undoEntryConfirm"))) {
        undoEntryMutation.mutate(entryId);
      }
    },
    [t, undoEntryMutation],
  );

  return (
    <SectionCard className="overflow-hidden">
      <div className="p-4 sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">
                {run.stageName ?? ""}
                {run.serviceName ? (
                  <span className="ms-2 text-sm font-normal text-muted-foreground">
                    {run.serviceName}
                  </span>
                ) : null}
              </h3>
              <Badge variant={isReverted ? "secondary" : "default"}>
                {isReverted ? t("reverted") : t("applied")}
              </Badge>
              <Badge variant="outline">{run.academicYear}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatLocalizedDate(run.createdAt, locale)}
              {run.notes ? ` — ${run.notes}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {t("entries", { total: run.totalEntries, undone: run.undoneEntries })}
            </Badge>
            {!isReverted && pendingEntries > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndoAll}
                disabled={undoAllMutation.isPending}
              >
                <RotateCcw className="size-4" />
                {t("undoAll")}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              {expanded ? t("collapse") : t("viewEntries")}
            </Button>
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-border">
          {entriesQuery.isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : entriesQuery.error ? (
            <p className="p-4 text-sm text-destructive">{entriesQuery.error.message}</p>
          ) : entries.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t("noEntries")}</p>
          ) : (
            <div className="divide-y divide-border">
              {entries.map((entry) => {
                const undone = !!entry.undoneAt;
                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between",
                      undone && "opacity-60",
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{entry.beneficiaryName}</span>
                        <Badge variant={undone ? "secondary" : entry.isGraduated ? "outline" : "default"}>
                          {entry.isGraduated ? t("graduated") : t("promoted")}
                        </Badge>
                        {undone ? <Badge variant="secondary">{t("undone")}</Badge> : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {entry.fromStageName ?? ""}
                        {entry.toStageName ? (
                          <>
                            <ArrowUpRight className="mx-1 inline size-3" />
                            {entry.toStageName}
                          </>
                        ) : null}
                        {entry.note ? ` — ${entry.note}` : ""}
                      </p>
                    </div>
                    {!undone ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUndoEntry(entry.id)}
                        disabled={undoEntryMutation.isPending}
                      >
                        <RotateCcw className="size-4" />
                        {t("undo")}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </SectionCard>
  );
}

export function PromotionsPage() {
  const t = useTranslations("promotions");
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [singleDialogOpen, setSingleDialogOpen] = useState(false);

  const runsQuery = usePromotionRuns();
  const cyclesQuery = usePromotionCycles();
  const runs = runsQuery.data ?? [];

  if (runsQuery.error) {
    return <ErrorState title={t("loadError")} message={runsQuery.error.message} />;
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setSingleDialogOpen(true)}>
              <Plus className="size-4" />
              {t("singlePromote")}
            </Button>
            <Button onClick={() => setRunDialogOpen(true)}>
              <ArrowUpRight className="size-4" />
              {t("runPromotion")}
            </Button>
          </div>
        }
      />

      {cyclesQuery.isLoading ? (
        <SectionCard>
          <div className="space-y-3 p-6">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-24 w-full" />
          </div>
        </SectionCard>
      ) : cyclesQuery.error ? null : (
        <PromotionCycleDashboard cycles={cyclesQuery.data ?? []} />
      )}

      {runsQuery.isLoading ? (
        <SectionCard>
          <div className="space-y-3 p-6">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </SectionCard>
      ) : runs.length === 0 ? (
        <EmptyState
          icon={<ArrowUpRight className="size-6 text-muted-foreground" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
        </div>
      )}

      <PromotionRunDialog open={runDialogOpen} onOpenChange={setRunDialogOpen} />
      <SinglePromoteDialog open={singleDialogOpen} onOpenChange={setSingleDialogOpen} />
    </section>
  );
}
