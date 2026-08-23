"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DollarSign,
  Users,
  Clock,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Building2,
  CalendarClock,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { PageTransition } from "@/components/motion/motion-primitives";
import { Badge } from "@/components/ui/badge";
import {
  BILLING_CONFIG,
  PLAN_PRICES,
  type PlatformBillingStats,
} from "../types/billing.types";
import { getPlatformBillingStatsAction } from "../actions/billing.actions";

export function PlatformBillingPage() {
  const t = useTranslations("admin.billing");
  const [stats, setStats] = useState<PlatformBillingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getPlatformBillingStatsAction();
      if (!cancelled && result.success && result.data) {
        setStats(result.data);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <PageTransition className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <SectionCard variant="elevated">
        <div className="p-6">
          <h3 className="font-semibold tracking-tight">{t("paymentMethod.title")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t("paymentMethod.description")}</p>
          <div className="mt-4 rounded-xl border border-border-whisper bg-muted/30 p-4">
            <p className="text-sm">
              <span className="text-muted-foreground">{t("paymentMethod.accountName")}:</span>{" "}
              <span className="font-medium">{BILLING_CONFIG.instapayAccountName}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">{t("paymentMethod.accountNumber")}:</span>{" "}
              <span className="font-medium">{BILLING_CONFIG.instapayAccountNumber}</span>
            </p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("paymentMethod.configNote")}
          </p>
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-3">
        <SectionCard>
          <div className="p-6 text-center">
            <div className="mx-auto rounded-2xl bg-primary/10 p-3 text-primary w-fit">
              <Users className="size-5" />
            </div>
            <p className="mt-3 text-2xl font-bold">{loading ? "--" : fmt(stats?.totalChurches ?? 0)}</p>
            <p className="text-sm text-muted-foreground">{t("stats.totalChurches")}</p>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="p-6 text-center">
            <div className="mx-auto rounded-2xl bg-gold/10 p-3 text-gold w-fit">
              <DollarSign className="size-5" />
            </div>
            <p className="mt-3 text-2xl font-bold">{loading ? "--" : `${fmt(stats?.totalRevenue ?? 0)} EGP`}</p>
            <p className="text-sm text-muted-foreground">{t("stats.totalRevenue")}</p>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="p-6 text-center">
            <div className="mx-auto rounded-2xl bg-warning/10 p-3 text-warning w-fit">
              <Clock className="size-5" />
            </div>
            <p className="mt-3 text-2xl font-bold">{loading ? "--" : fmt(stats?.pendingPaymentRequests ?? 0)}</p>
            <p className="text-sm text-muted-foreground">{t("stats.pendingRequests")}</p>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SectionCard>
          <div className="p-4 text-center">
            <p className="text-lg font-bold text-primary">{loading ? "--" : fmt(stats?.monthlySubscriptions ?? 0)}</p>
            <p className="text-xs text-muted-foreground">{t("stats.monthlySubscriptions")}</p>
          </div>
        </SectionCard>
        <SectionCard>
          <div className="p-4 text-center">
            <p className="text-lg font-bold text-gold">{loading ? "--" : fmt(stats?.yearlySubscriptions ?? 0)}</p>
            <p className="text-xs text-muted-foreground">{t("stats.yearlySubscriptions")}</p>
          </div>
        </SectionCard>
        <SectionCard>
          <div className="p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <AlertTriangle className="size-4 text-warning" />
              <p className="text-lg font-bold text-warning">{loading ? "--" : fmt(stats?.expiringSubscriptions ?? 0)}</p>
            </div>
            <p className="text-xs text-muted-foreground">{t("stats.expiringSubscriptions")}</p>
          </div>
        </SectionCard>
        <SectionCard>
          <div className="p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <CalendarClock className="size-4 text-destructive" />
              <p className="text-lg font-bold text-destructive">{loading ? "--" : fmt(stats?.gracePeriodChurches ?? 0)}</p>
            </div>
            <p className="text-xs text-muted-foreground">{t("stats.gracePeriodChurches")}</p>
          </div>
        </SectionCard>
      </div>

      {/* Administrative plan configuration — NOT a customer pricing page.
          The Platform Owner views the configured plans and their adoption;
          there are intentionally no Subscribe/Upgrade/Pay CTAs here. */}
      <SectionCard>
        <div className="p-6">
          <h3 className="font-semibold tracking-tight">{t("plans.title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("plans.description")}</p>

          <div className="mt-4 overflow-x-auto rounded-xl border border-border-whisper">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-whisper bg-muted/40">
                  <th className="p-3 text-start font-medium text-muted-foreground">{t("plans.plan")}</th>
                  <th className="p-3 text-start font-medium text-muted-foreground">{t("plans.price")}</th>
                  <th className="p-3 text-start font-medium text-muted-foreground">{t("plans.churchesUsing")}</th>
                  <th className="p-3 text-start font-medium text-muted-foreground">{t("plans.status")}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border-whisper last:border-b-0">
                  <td className="p-3 font-medium">{t("plans.free")}</td>
                  <td className="p-3">0 EGP</td>
                  <td className="p-3">{loading ? "--" : fmt(stats?.freeChurches ?? 0)}</td>
                  <td className="p-3"><Badge variant="outline">{t("plans.statusActive")}</Badge></td>
                </tr>
                <tr className="border-b border-border-whisper last:border-b-0">
                  <td className="p-3 font-medium">{t("plans.trial")}</td>
                  <td className="p-3">{t("plans.trialPrice", { days: BILLING_CONFIG.trialDurationDays })}</td>
                  <td className="p-3">{loading ? "--" : fmt(stats?.trialChurches ?? 0)}</td>
                  <td className="p-3"><Badge variant="outline">{t("plans.statusActive")}</Badge></td>
                </tr>
                <tr className="border-b border-border-whisper last:border-b-0">
                  <td className="p-3 font-medium">{t("plans.monthly")}</td>
                  <td className="p-3">{fmt(PLAN_PRICES.monthly.amount)} EGP {t("plans.monthlyPeriod")}</td>
                  <td className="p-3">{loading ? "--" : fmt(stats?.monthlySubscriptions ?? 0)}</td>
                  <td className="p-3"><Badge variant="outline">{t("plans.statusActive")}</Badge></td>
                </tr>
                <tr className="border-b border-border-whisper last:border-b-0">
                  <td className="p-3 font-medium">{t("plans.yearly")}</td>
                  <td className="p-3">{fmt(PLAN_PRICES.yearly.amount)} EGP {t("plans.yearlyPeriod")}</td>
                  <td className="p-3">{loading ? "--" : fmt(stats?.yearlySubscriptions ?? 0)}</td>
                  <td className="p-3"><Badge variant="outline">{t("plans.statusActive")}</Badge></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="p-6">
          <h3 className="font-semibold tracking-tight">{t("upcoming.title")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t("upcoming.description")}</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" />
              {t("upcoming.paymentReview")}
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" />
              {t("upcoming.refundManagement")}
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" />
              {t("upcoming.subscriptionDashboard")}
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" />
              {t("upcoming.invoiceManagement")}
            </li>
          </ul>
        </div>
      </SectionCard>
    </PageTransition>
  );
}
