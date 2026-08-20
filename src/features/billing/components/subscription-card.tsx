"use client";

import { useTranslations } from "next-intl";
import { Crown, Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/layout/section-card";
import { useBillingSummary } from "../hooks/use-billing";
import { getEffectivePlan, getRemainingDays } from "../lib/entitlements";

export function SubscriptionCard() {
  const t = useTranslations("billing.subscription");
  const { data, isLoading } = useBillingSummary();

  if (isLoading) {
    return (
      <SectionCard>
        <div className="p-6 space-y-3">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
      </SectionCard>
    );
  }

  const summary = data?.data;
  if (!summary) return null;

  const effectivePlan = getEffectivePlan(
    summary.plan,
    summary.trialEndsAt,
    summary.subscriptionExpiresAt,
    new Date(),
    summary.status,
  );

  const remainingDays = getRemainingDays(
    effectivePlan,
    summary.trialEndsAt,
    summary.subscriptionExpiresAt,
  );

  const isTrial = effectivePlan === "trial";
  const isPaid = effectivePlan === "monthly" || effectivePlan === "yearly";
  const isFree = effectivePlan === "free";

  const planLabel = t(`plans.${effectivePlan}`);

  return (
    <SectionCard variant="elevated">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {isPaid ? (
                <Crown className="size-5 text-gold" />
              ) : isTrial ? (
                <Clock className="size-5 text-ministry" />
              ) : (
                <AlertTriangle className="size-5 text-muted-foreground" />
              )}
              <h3 className="text-lg font-semibold tracking-tight">{t("currentPlan")}</h3>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={isPaid ? "default" : isTrial ? "secondary" : "outline"}>
                {planLabel}
              </Badge>
              {summary.status === "grace" && (
                <Badge variant="destructive">{t("gracePeriod")}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          {isTrial && remainingDays !== null && (
            <p>
              {t("trialRemaining", { days: remainingDays })}
            </p>
          )}

          {isTrial && (
            <p className="text-xs">
              {t("trialExplanation")}
            </p>
          )}

          {isPaid && summary.subscriptionExpiresAt && (
            <p>
              {t("validUntil", {
                date: new Date(summary.subscriptionExpiresAt).toLocaleDateString(),
              })}
            </p>
          )}

          {isFree && !isTrial && (
            <p>{t("freePlanDescription")}</p>
          )}

          {isFree && summary.trialUsed && (
            <p className="text-xs">{t("trialAlreadyUsed")}</p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
