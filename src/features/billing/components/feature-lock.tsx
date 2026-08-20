"use client";

import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type FeatureLockProps = {
  featureName: string;
  description?: string;
};

export function FeatureLock({ featureName, description }: FeatureLockProps) {
  const t = useTranslations("billing.featureLock");

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-whisper bg-surface-elevated px-6 py-10 text-center">
      <div className="rounded-2xl bg-muted p-4 text-muted-foreground">
        <Lock className="size-6" aria-hidden="true" />
      </div>
      <h3 className="mt-3 text-sm font-semibold tracking-tight">{featureName}</h3>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        {description ?? t("description")}
      </p>
      <div className="mt-3">
        <Button render={<Link href="/pricing" />} variant="outline" size="sm">
          {t("viewPlans")}
        </Button>
      </div>
    </div>
  );
}
