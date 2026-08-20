"use client";

import { useTranslations } from "next-intl";
import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/layout/section-card";
import { PLAN_PRICES, YEARLY_SAVINGS, type PaidPlan } from "../types/billing.types";

type PricingCardProps = {
  plan: PaidPlan;
  isCurrentPlan?: boolean;
  onSelectPlan: (plan: PaidPlan) => void;
};

export function PricingCard({ plan, isCurrentPlan, onSelectPlan }: PricingCardProps) {
  const t = useTranslations("billing.pricing");
  const config = PLAN_PRICES[plan];
  const isYearly = plan === "yearly";

  const features = [
    "unlimitedServices",
    "unlimitedStages",
    "unlimitedServants",
    "unlimitedBeneficiaries",
    "unlimitedEvents",
    "advancedReports",
    "advancedAnalytics",
    "aiAssistant",
    "bulkImport",
    "advancedExport",
    "advancedCrm",
    "notifications",
    "spiritualJournal",
  ] as const;

  return (
    <SectionCard variant={isYearly ? "elevated" : "default"}>
      <div className={`p-6 ${isYearly ? "relative" : ""}`}>
        {isYearly && (
          <div className="absolute -top-3 start-6">
            <Badge className="bg-gold text-white">
              <Star className="me-1 size-3" />
              {t("recommended")}
            </Badge>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">{t(`planName.${plan}`)}</h3>
            <p className="text-sm text-muted-foreground">{t(`planDescription.${plan}`)}</p>
          </div>

          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight">{config.amount}</span>
              <span className="text-sm text-muted-foreground">{config.currency}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t(`pricePeriod.${plan}`)}</p>
          </div>

          {isYearly && (
            <div className="rounded-xl bg-gold/10 p-3 text-sm">
              <p className="font-medium text-gold-deep">
                {t("yearlySavings", { amount: YEARLY_SAVINGS.savedAmount, percent: YEARLY_SAVINGS.savedPercent })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("yearlyComparison", { monthly: PLAN_PRICES.monthly.amount * 12, yearly: config.amount })}
              </p>
            </div>
          )}

          <ul className="space-y-2">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-ministry" />
                <span>{t(`features.${feature}`)}</span>
              </li>
            ))}
          </ul>

          <Button
            className="w-full"
            variant={isYearly ? "default" : "outline"}
            onClick={() => onSelectPlan(plan)}
            disabled={isCurrentPlan}
          >
            {isCurrentPlan ? t("currentPlan") : t("selectPlan")}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
