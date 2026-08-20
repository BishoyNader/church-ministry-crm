"use client";

import { useTranslations } from "next-intl";
import { CreditCard, Copy, Shield, Clock, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/layout/section-card";
import { BILLING_CONFIG, PLAN_PRICES, type PaidPlan } from "../types/billing.types";

type PaymentInstructionsProps = {
  plan: PaidPlan;
  onBack: () => void;
};

export function PaymentInstructions({ plan, onBack }: PaymentInstructionsProps) {
  const t = useTranslations("billing.payment");
  const config = PLAN_PRICES[plan];

  const steps = [
    { step: 1, icon: CreditCard, key: "step1" },
    { step: 2, icon: Copy, key: "step2" },
    { step: 3, icon: CreditCard, key: "step3" },
    { step: 4, icon: Shield, key: "step4" },
    { step: 5, icon: Clock, key: "step5" },
  ];

  return (
    <SectionCard variant="elevated">
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{t("title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>

        <div className="rounded-xl border border-border-whisper bg-muted/30 p-4">
          <p className="text-sm font-medium">{t("amountDue")}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">
            {config.amount} {config.currency}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(`planPeriod.${plan}`)}
          </p>
        </div>

        <div className="rounded-xl border border-border-whisper p-4">
          <p className="text-sm font-semibold">{t("instapayAccount")}</p>
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">{t("accountName")}:</span>{" "}
            <span className="font-medium">{BILLING_CONFIG.instapayAccountName}</span>
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">{t("accountNumber")}:</span>{" "}
            <span className="font-medium">{BILLING_CONFIG.instapayAccountNumber}</span>
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold">{t("stepsTitle")}</h4>
          {steps.map(({ step, key }) => (
            <div key={step} className="flex items-start gap-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {step}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{t(`${key}.title`)}</p>
                <p className="text-xs text-muted-foreground">{t(`${key}.description`)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-muted/30 p-4 text-xs text-muted-foreground space-y-2">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <HelpCircle className="size-4" />
            {t("importantNotes")}
          </p>
          <ul className="space-y-1 list-disc ps-5">
            <li>{t("notes.exactAmount")}</li>
            <li>{t("notes.keepReference")}</li>
            <li>{t("notes.manualVerification")}</li>
            <li>{t("notes.activationTime")}</li>
          </ul>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t("questions")}</span>
          <a
            href={`mailto:${BILLING_CONFIG.supportEmail}`}
            className="text-primary hover:underline"
          >
            {BILLING_CONFIG.supportEmail}
          </a>
        </div>

        <Button variant="outline" onClick={onBack} className="w-full">
          {t("back")}
        </Button>
      </div>
    </SectionCard>
  );
}
