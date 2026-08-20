"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CreditCard, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/layout/section-card";
import { PaymentRequestForm } from "./payment-request-form";
import { PaymentInstructions } from "./payment-instructions";
import { PricingCard } from "./pricing-card";
import { SubscriptionCard } from "./subscription-card";
import { useBillingSummary } from "../hooks/use-billing";
import { getEffectivePlan } from "../lib/entitlements";
import type { PaidPlan } from "../types/billing.types";

type View = "overview" | "select-plan" | "instructions" | "submit-payment" | "success";

export function BillingPage() {
  const t = useTranslations("billing");
  const { data: summary } = useBillingSummary();
  const [view, setView] = useState<View>("overview");
  const [selectedPlan, setSelectedPlan] = useState<PaidPlan | null>(null);

  const billingSummary = summary?.data;
  const effectivePlan = billingSummary
    ? getEffectivePlan(billingSummary.plan, billingSummary.trialEndsAt, billingSummary.subscriptionExpiresAt, new Date(), billingSummary.status)
    : "free";

  const isPaid = effectivePlan === "monthly" || effectivePlan === "yearly";

  const handleSelectPlan = (plan: PaidPlan) => {
    setSelectedPlan(plan);
    setView("instructions");
  };

  const handleProceedToPayment = () => {
    setView("submit-payment");
  };

  const handlePaymentSubmitted = () => {
    setView("success");
  };

  if (view === "select-plan") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setView("overview")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t("selectPlan.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("selectPlan.description")}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <PricingCard
            plan="monthly"
            isCurrentPlan={effectivePlan === "monthly"}
            onSelectPlan={handleSelectPlan}
          />
          <PricingCard
            plan="yearly"
            isCurrentPlan={effectivePlan === "yearly"}
            onSelectPlan={handleSelectPlan}
          />
        </div>
      </div>
    );
  }

  if (view === "instructions" && selectedPlan) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setView("select-plan")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t("paymentInstructions.title")}</h1>
          </div>
        </div>

        <PaymentInstructions
          plan={selectedPlan}
          onBack={() => setView("select-plan")}
        />

        <Button onClick={handleProceedToPayment} className="w-full">
          {t("paymentInstructions.proceedToPayment")}
        </Button>
      </div>
    );
  }

  if (view === "submit-payment" && selectedPlan) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setView("instructions")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t("form.title")}</h1>
          </div>
        </div>

        <PaymentRequestForm
          plan={selectedPlan}
          onSuccess={handlePaymentSubmitted}
          onCancel={() => setView("instructions")}
        />
      </div>
    );
  }

  if (view === "success") {
    return (
      <div className="space-y-6">
        <SectionCard variant="elevated">
          <div className="flex flex-col items-center p-8 text-center">
            <div className="rounded-full bg-success/10 p-4 text-success">
              <CheckCircle2 className="size-10" />
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-tight">{t("success.title")}</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {t("success.description")}
            </p>
            <div className="mt-4 rounded-xl border border-border-whisper bg-muted/30 p-4 text-sm">
              <p>{t("success.nextSteps")}</p>
              <ul className="mt-2 space-y-1 list-disc ps-5 text-muted-foreground">
                <li>{t("success.step1")}</li>
                <li>{t("success.step2")}</li>
                <li>{t("success.step3")}</li>
              </ul>
            </div>
            <Button className="mt-6" onClick={() => setView("overview")}>
              {t("success.backToBilling")}
            </Button>
          </div>
        </SectionCard>
      </div>
    );
  }

  // Overview (default)
  return (
    <div className="space-y-6">
      <SubscriptionCard />

      {!isPaid && (
        <SectionCard>
          <div className="p-6">
            <h3 className="font-semibold tracking-tight">{t("upgrade.title")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("upgrade.description")}</p>
            <Button className="mt-4" onClick={() => setView("select-plan")}>
              <CreditCard className="me-2 size-4" />
              {t("upgrade.cta")}
            </Button>
          </div>
        </SectionCard>
      )}

      {isPaid && billingSummary?.subscriptionExpiresAt && (
        <SectionCard>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold tracking-tight">{t("currentPlan.title")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("currentPlan.validUntil", {
                    date: new Date(billingSummary.subscriptionExpiresAt).toLocaleDateString(),
                  })}
                </p>
              </div>
              <Button variant="outline" onClick={() => setView("select-plan")}>
                {t("currentPlan.changePlan")}
              </Button>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
