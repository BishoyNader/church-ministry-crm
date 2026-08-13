"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  Eye,
  HandHeart,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/layout/section-card";
import { StatCard } from "@/components/layout/stat-card";
import { InlineNotice } from "@/components/ui/inline-notice";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatLocalizedDate } from "@/lib/dates";
import {
  usePromotionCycleEntries,
  usePromotionTransitions,
  useConfirmPromotionCycle,
} from "../hooks/use-promotions";
import type { PromotionCycle } from "../types/promotions.types";


function ReviewPanel({ cycleId }: { cycleId: string }) {
  const t = useTranslations("promotions.cycles");
  const entriesQuery = usePromotionCycleEntries(cycleId);
  const transitionsQuery = usePromotionTransitions(cycleId);

  const entries = entriesQuery.data ?? [];
  const transitions = transitionsQuery.data ?? [];

  if (entriesQuery.isLoading || transitionsQuery.isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">{t("beneficiaryPlacements")}</h4>
        {entriesQuery.error ? (
          <p className="text-sm text-destructive">{entriesQuery.error.message}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noEntries")}</p>
        ) : (
          <div className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "flex items-center justify-between gap-2 px-3 py-2 text-sm",
                  entry.undoneAt && "opacity-60",
                )}
              >
                <span className="truncate font-medium">{entry.beneficiaryName}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  {entry.fromStageName ?? ""}
                  <ArrowRight className="size-3" />
                  {entry.isGraduated ? t("graduated") : (entry.toStageName ?? "")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">{t("servantTransitions")}</h4>
        {transitionsQuery.error ? (
          <p className="text-sm text-destructive">{transitionsQuery.error.message}</p>
        ) : transitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noTransitions")}</p>
        ) : (
          <div className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border">
            {transitions.map((transition) => (
              <div
                key={transition.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span className="truncate font-medium">{transition.servantName}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  {transition.fromServiceName ?? ""} · {transition.fromStageName ?? ""}
                  <ArrowRight className="size-3" />
                  {transition.toServiceName ?? ""} · {transition.toStageName ?? ""}
                </span>
                {transition.status === "pending" ? (
                  <Badge variant="outline" className="text-xs">
                    {t("transitionPending")}
                  </Badge>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t("reviewNote")}</p>
      </div>
    </div>
  );
}

function ConfirmDialog({
  cycle,
  open,
  onOpenChange,
}: {
  cycle: PromotionCycle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("promotions.cycles");
  const confirmMutation = useConfirmPromotionCycle();

  const handleConfirm = async () => {
    const result = await confirmMutation.mutateAsync(cycle.id);
    if (result.success) onOpenChange(false);
  };

  const error = confirmMutation.data && !confirmMutation.data.success
    ? confirmMutation.data.message
    : confirmMutation.error?.message ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("confirmTitle")}</DialogTitle>
          <DialogDescription>
            {t("confirmDescription", { year: cycle.academicYear })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <InlineNotice variant="warning">
            <p>
              {t("confirmWarning", {
                servants: cycle.affectedServants,
                transitions: cycle.pendingTransitions,
              })}
            </p>
          </InlineNotice>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">{t("beneficiaries")}</dt>
              <dd className="mt-1 text-lg font-bold">{cycle.beneficiariesPromoted}</dd>
            </div>
            <div className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">{t("pendingTransitions")}</dt>
              <dd className="mt-1 text-lg font-bold">{cycle.pendingTransitions}</dd>
            </div>
          </dl>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("cancel")}
          </DialogClose>
          <Button onClick={handleConfirm} disabled={confirmMutation.isPending}>
            {confirmMutation.isPending ? t("processing") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

export function PromotionCycleDashboard({ cycles }: { cycles: PromotionCycle[] }) {
  const t = useTranslations("promotions.cycles");
  const locale = useLocale();

  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmCycle, setConfirmCycle] = useState<PromotionCycle | null>(null);

  const pendingCycle =
    cycles.find((cycle) => cycle.status === "pending_confirmation") ?? null;
  const confirmedCycles = cycles.filter((cycle) => cycle.status === "confirmed");

  if (!pendingCycle && confirmedCycles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {pendingCycle ? (
        <SectionCard className="overflow-hidden">
          <div className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent p-4 sm:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold tracking-tight">
                    {t("title", { year: pendingCycle.academicYear })}
                  </h3>
                  <Badge variant="warning">
                    <AlertTriangle className="size-3" />
                    {t("needsConfirmation")}
                  </Badge>
                </div>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  {t("description")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setReviewOpen((value) => !value)}
                  aria-expanded={reviewOpen}
                >
                  {reviewOpen ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                  {reviewOpen ? t("hideReview") : t("review")}
                </Button>
                <Button onClick={() => setConfirmCycle(pendingCycle)}>
                  <ClipboardCheck className="size-4" />
                  {t("confirmAction")}
                </Button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label={t("beneficiaries")}
                value={pendingCycle.beneficiariesPromoted}
                icon={UserRound}
              />
              <StatCard
                label={t("affectedServices")}
                value={pendingCycle.affectedServices}
                icon={Building2}
              />
              <StatCard
                label={t("affectedServants")}
                value={pendingCycle.affectedServants}
                icon={HandHeart}
              />
              <StatCard
                label={t("pendingTransitions")}
                value={pendingCycle.pendingTransitions}
                icon={ClipboardList}
                tone="warning"
              />
            </div>
          </div>

          {reviewOpen ? <ReviewPanel cycleId={pendingCycle.id} /> : null}
        </SectionCard>
      ) : null}

      {confirmedCycles.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {confirmedCycles.map((cycle) => (
            <div
              key={cycle.id}
              className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm"
            >
              <ShieldCheck className="size-4 text-success" />
              <span className="font-medium">
                {t("title", { year: cycle.academicYear })}
              </span>
              <Badge variant="secondary" className="text-xs">
                <CheckCircle2 className="size-3" />
                {t("confirmed")}
              </Badge>
              {cycle.confirmedAt ? (
                <span className="text-xs text-muted-foreground">
                  {formatLocalizedDate(cycle.confirmedAt, locale)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {confirmCycle ? (
        <ConfirmDialog
          cycle={confirmCycle}
          open={!!confirmCycle}
          onOpenChange={(open) => {
            if (!open) setConfirmCycle(null);
          }}
        />
      ) : null}
    </div>
  );
}
