"use client";

import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { useTranslations } from "next-intl";

const features = [
  "features.volunteerCoordination",
  "features.memberEngagement",
  "features.simpleReporting",
] as const;

export default function Home() {
  const t = useTranslations("home");
  const translations = useTranslations();

  return (
    <AppShell>
      <PageShell title="Church Operations Overview" description="A responsive workspace for managing ministry activity.">
        <div className="space-y-6">
          <div className="rounded-3xl border border-border-whisper bg-primary/5 p-6 shadow-diffused-sm">
            <p className="text-sm font-medium text-ministry">{t("badge")}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{t("title")}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{t("description")}</p>
          </div>

          <div id="features" className="grid gap-4 md:grid-cols-3">
            {features.map((featureKey) => (
              <article
                key={featureKey}
                className="rounded-2xl border border-border-whisper bg-surface-elevated p-5 shadow-diffused-sm"
              >
                <h3 className="text-lg font-semibold tracking-tight">{translations(`${featureKey}.title`)}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {translations(`${featureKey}.description`)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </PageShell>
    </AppShell>
  );
}
