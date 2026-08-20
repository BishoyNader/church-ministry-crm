"use client";

import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useBillingSummary } from "../hooks/use-billing";
import { getEffectivePlan, getRemainingDays } from "../lib/entitlements";
import { Link } from "@/i18n/navigation";

export function TrialCountdown() {
  const t = useTranslations("billing.trial");
  const { data: summary } = useBillingSummary();

  const billingSummary = summary?.data;
  if (!billingSummary) return null;

  const effectivePlan = getEffectivePlan(
    billingSummary.plan,
    billingSummary.trialEndsAt,
    billingSummary.subscriptionExpiresAt,
    new Date(),
    billingSummary.status,
  );

  if (effectivePlan !== "trial") return null;

  const remainingDays = getRemainingDays(
    "trial",
    billingSummary.trialEndsAt,
    billingSummary.subscriptionExpiresAt,
  );

  if (remainingDays === null) return null;

  const urgent = remainingDays <= 3;
  const warning = remainingDays <= 7;

  return (
    <Link
      href="/billing"
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
        urgent
          ? "border-danger/30 bg-danger/5 text-danger"
          : warning
            ? "border-warning/30 bg-warning/5 text-warning"
            : "border-ministry/30 bg-ministry/5 text-ministry"
      }`}
    >
      <Clock className="size-4 shrink-0" />
      <span className="font-medium">
        {t("daysRemaining", { days: remainingDays })}
      </span>
      <Badge variant={urgent ? "destructive" : "secondary"} className="ms-auto text-xs">
        {t("upgrade")}
      </Badge>
    </Link>
  );
}
