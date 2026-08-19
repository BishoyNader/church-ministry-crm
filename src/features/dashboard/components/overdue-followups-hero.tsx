"use client";

import { useTranslations, useLocale } from "next-intl";
import { AlertCircle, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type OverdueFollowupsHeroProps = {
  overdue: number;
  isLoading: boolean;
};

export function OverdueFollowupsHero({ overdue, isLoading }: OverdueFollowupsHeroProps) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const hasOverdue = overdue > 0;

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm animate-pulse">
        <div className="h-16 w-3/4 rounded bg-muted" />
      </div>
    );
  }

  return (
    <Link href={`/${locale}/followups`} className="block">
      <div
        className={
          "group relative overflow-hidden rounded-xl border p-4 shadow-md transition-all duration-200 hover:shadow-lg sm:p-6 lg:p-8 " +
          (hasOverdue
            ? "border-destructive/30 bg-destructive/5"
            : "border-success/25 bg-success/5")
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 sm:gap-5 min-w-0">
            <div
              className={
                "mt-0.5 sm:mt-1 rounded-xl p-2 sm:p-3 shrink-0 " +
                (hasOverdue
                  ? "bg-destructive/10 text-destructive"
                  : "bg-success/10 text-success")
              }
            >
              {hasOverdue ? (
                <AlertCircle className="size-6 sm:size-7" />
              ) : (
                <CheckCircle2 className="size-6 sm:size-7" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {hasOverdue ? t("overdueFollowups.label") : t("followupStatus.title")}
              </p>
              <p
                className={
                  "mt-0.5 sm:mt-1 text-3xl sm:text-4xl lg:text-5xl font-bold tabular-nums " +
                  (hasOverdue ? "text-destructive" : "text-success")
                }
              >
                {overdue}
              </p>
              <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground">
                {hasOverdue
                  ? t("overdueFollowups.description", { count: overdue })
                  : t("overdueFollowups.allClear")}
              </p>
            </div>
          </div>
          <div className="hidden shrink-0 sm:block">
            <span
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors " +
                (hasOverdue
                  ? "border-destructive/30 bg-destructive/10 text-destructive group-hover:bg-destructive/15"
                  : "border-border-whisper bg-surface-elevated text-muted-foreground group-hover:text-foreground")
              }
            >
              {t("overdueFollowups.viewAll")}
              {isRtl ? <ArrowLeft className="size-3.5" /> : <ArrowRight className="size-3.5" />}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
