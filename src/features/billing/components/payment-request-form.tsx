"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { SectionCard } from "@/components/layout/section-card";
import { submitPaymentRequestAction } from "../actions/billing.actions";
import { PLAN_PRICES, type PaidPlan } from "../types/billing.types";

type PaymentRequestFormProps = {
  plan: PaidPlan;
  onSuccess: () => void;
  onCancel: () => void;
};

export function PaymentRequestForm({ plan, onSuccess, onCancel }: PaymentRequestFormProps) {
  const t = useTranslations("billing.form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [transferDate, setTransferDate] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [note, setNote] = useState("");

  const config = PLAN_PRICES[plan];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitPaymentRequestAction({
        plan,
        transferDate: transferDate || undefined,
        paymentReference: paymentReference || undefined,
        note: note || undefined,
      });

      if (result.success) {
        onSuccess();
      } else {
        setError(result.message ?? "Failed to submit payment request.");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SectionCard variant="elevated">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{t("title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>

        <div className="rounded-xl border border-border-whisper bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">{t("plan")}</p>
          <p className="font-semibold">{t(`plans.${plan}`)}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">
            {config.amount} {config.currency}
          </p>
        </div>

        <FormField label={t("transferDate")}>
          <Input
            type="date"
            value={transferDate}
            onChange={(e) => setTransferDate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
          />
        </FormField>

        <FormField label={t("paymentReference")}>
          <Input
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder={t("referencePlaceholder")}
          />
        </FormField>

        <FormField label={t("note")}>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("notePlaceholder")}
            rows={3}
          />
        </FormField>

        {error && (
          <div className="rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? t("submitting") : t("submit")}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            {t("cancel")}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {t("afterSubmission")}
        </p>
      </form>
    </SectionCard>
  );
}
