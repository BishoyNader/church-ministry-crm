import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { BarChart3, Church, HeartHandshake, Users } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { HeroIllustration } from "@/components/illustrations/hero-illustration";

const featureIcons = [Users, HeartHandshake, BarChart3] as const;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocalizedHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations();

  const features = [
    { key: "volunteerCoordination", icon: featureIcons[0] },
    { key: "memberEngagement", icon: featureIcons[1] },
    { key: "simpleReporting", icon: featureIcons[2] },
  ] as const;

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-surface-dashboard text-foreground">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 start-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 end-0 h-80 w-80 rounded-full bg-ministry/10 blur-3xl" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary p-2 text-primary-foreground shadow-diffused-md">
            <Church className="size-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Church CRM</span>
        </div>
        <div className="flex items-center gap-2">
          <Button render={<Link href={`/${locale}/login`} />} variant="ghost" size="sm">
            {t("home.signIn")}
          </Button>
          <Button render={<Link href={`/${locale}/signup`} />} size="sm">
            {t("home.getStarted")}
          </Button>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-16 sm:px-8 lg:px-12">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border-whisper bg-surface-elevated px-3.5 py-1.5 text-sm font-medium text-ministry shadow-diffused-sm">
              {t("home.badge")}
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              {t("home.title")}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
              {t("home.description")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                render={<Link href={`/${locale}/signup`} />}
                className="h-12 rounded-full px-6"
              >
                {t("home.primaryAction")}
              </Button>
              <Button
                render={<Link href={`/${locale}/login`} />}
                variant="outline"
                className="h-12 rounded-full px-6"
              >
                {t("home.secondaryAction")}
              </Button>
            </div>
          </div>

          <div className="rounded-hero border border-border-whisper bg-surface-elevated p-4 shadow-diffused-lg">
            <HeroIllustration />
          </div>
        </div>

        <div id="features" className="mt-20 grid gap-4 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.key}
                className="rounded-card border border-border-whisper bg-surface-elevated p-6 shadow-diffused-sm transition-shadow duration-200 hover:shadow-diffused-md"
              >
                <div className="rounded-2xl bg-ministry/10 p-3 text-ministry">
                  <Icon className="size-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold tracking-tight">
                  {t(`features.${feature.key}.title`)}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t(`features.${feature.key}.description`)}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="relative z-10 border-t border-border-whisper py-6 text-center text-xs text-muted-foreground">
        {t("home.footerTagline")}
      </footer>
    </main>
  );
}
