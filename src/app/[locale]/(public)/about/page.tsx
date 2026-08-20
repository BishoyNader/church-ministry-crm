import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Church, Users, HeartHandshake, BarChart3 } from "lucide-react";
import { BILLING_CONFIG } from "@/features/billing/types/billing.types";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations("public.about");

  const capabilities = [
    { icon: Users, key: "volunteerManagement" },
    { icon: HeartHandshake, key: "memberEngagement" },
    { icon: BarChart3, key: "reporting" },
    { icon: Church, key: "churchOperations" },
  ] as const;

  return (
    <main className="min-h-screen bg-surface-dashboard text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-12 lg:px-8">
        <div className="mb-8">
          <Button render={<Link href={`/${locale}`} />} variant="ghost" size="sm">
            <ArrowLeft className="me-2 size-4" />
            {t("backToHome")}
          </Button>
        </div>

        <div className="mb-12">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl leading-8">
            {t("description")}
          </p>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight mb-6">{t("purpose.title")}</h2>
          <p className="text-muted-foreground leading-8">{t("purpose.description")}</p>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight mb-6">{t("capabilities.title")}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {capabilities.map(({ icon: Icon, key }) => (
              <div key={key} className="rounded-card border border-border-whisper bg-surface-elevated p-5 shadow-diffused-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-ministry/10 p-2.5 text-ministry">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-medium">{t(`capabilities.${key}.title`)}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t(`capabilities.${key}.description`)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight mb-6">{t("serves.title")}</h2>
          <p className="text-muted-foreground leading-8">{t("serves.description")}</p>
        </div>

        <div className="mb-12 rounded-card border border-border-whisper bg-surface-elevated p-6">
          <h2 className="text-xl font-semibold tracking-tight">{t("contact.title")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("contact.description")}</p>
          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">{t("contact.email")}:</span>{" "}
              <a href={`mailto:${BILLING_CONFIG.supportEmail}`} className="text-primary hover:underline">
                {BILLING_CONFIG.supportEmail}
              </a>
            </p>
            {BILLING_CONFIG.supportPhone !== "+20-PLACEHOLDER" && (
              <p>
                <span className="text-muted-foreground">{t("contact.phone")}:</span>{" "}
                {BILLING_CONFIG.supportPhone}
              </p>
            )}
          </div>
          <Button render={<Link href={`/${locale}/contact`} />} variant="outline" className="mt-4">
            {t("contact.cta")}
          </Button>
        </div>

        <footer className="border-t border-border-whisper py-6 text-center text-xs text-muted-foreground">
          {t("footer")}
        </footer>
      </div>
    </main>
  );
}
