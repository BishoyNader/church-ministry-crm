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
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900/40 dark:bg-emerald-950/30">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{t("badge")}</p>
            <h2 className="mt-2 text-2xl font-semibold">{t("title")}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{t("description")}</p>
          </div>

          <div id="features" className="grid gap-4 md:grid-cols-3">
            {features.map((featureKey) => (
              <article
                key={featureKey}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50"
              >
                <h3 className="text-lg font-semibold">{translations(`${featureKey}.title`)}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
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
