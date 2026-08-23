import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Check, Star, ArrowLeft } from "lucide-react";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);

  // Server-side separation (not just UI): the Platform Owner is the SaaS
  // administrator, not a subscriber. Never show them customer pricing /
  // purchase CTAs — route them to platform billing management instead.
  const supabase = await createClient();
  const { data: isPlatformOwner } = await supabase.rpc("user_is_platform_owner");
  if (isPlatformOwner) {
    redirect(`/${locale}/admin/billing`);
  }

  const t = await getTranslations("public.pricing");

  return (
    <main className="min-h-screen bg-surface-dashboard text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-12 lg:px-8">
        <div className="mb-8">
          <Button render={<Link href={`/${locale}`} />} variant="ghost" size="sm">
            <ArrowLeft className="me-2 size-4" />
            {t("backToHome")}
          </Button>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("description")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-12">
          {/* Free */}
          <div className="rounded-card border border-border-whisper bg-surface-elevated p-6 shadow-diffused-sm">
            <h3 className="text-lg font-semibold">{t("plans.free")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("plans.freeDescription")}</p>
            <div className="mt-4">
              <p className="text-3xl font-bold">0 EGP</p>
              <p className="text-xs text-muted-foreground">{t("plans.freePeriod")}</p>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ministry" />{t("features.oneService")}</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ministry" />{t("features.tenServants")}</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ministry" />{t("features.thirtyBeneficiaries")}</li>
            </ul>
            <Button render={<Link href={`/${locale}/signup`} />} variant="outline" className="w-full mt-6">
              {t("cta.getStarted")}
            </Button>
          </div>

          {/* Trial */}
          <div className="rounded-card border border-ministry/30 bg-surface-elevated p-6 shadow-diffused-sm">
            <h3 className="text-lg font-semibold">{t("plans.trial")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("plans.trialDescription")}</p>
            <div className="mt-4">
              <p className="text-3xl font-bold">Free</p>
              <p className="text-xs text-muted-foreground">{t("plans.trialPeriod")}</p>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ministry" />{t("features.allFeatures")}</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ministry" />{t("features.thirtyDays")}</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ministry" />{t("features.noCreditCard")}</li>
            </ul>
            <Button render={<Link href={`/${locale}/signup`} />} className="w-full mt-6">
              {t("cta.startTrial")}
            </Button>
          </div>

          {/* Yearly (Recommended) */}
          <div className="relative rounded-card border border-gold/30 bg-surface-elevated p-6 shadow-diffused-md">
            <div className="absolute -top-3 start-6">
              <span className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-white">
                <Star className="size-3" />
                {t("plans.recommended")}
              </span>
            </div>
            <h3 className="text-lg font-semibold">{t("plans.yearly")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("plans.yearlyDescription")}</p>
            <div className="mt-4">
              <p className="text-3xl font-bold">3,999 EGP</p>
              <p className="text-xs text-muted-foreground">{t("plans.yearlyPeriod")}</p>
            </div>
            <div className="mt-2 rounded-lg bg-gold/10 p-2 text-xs text-gold-deep">
              {t("plans.yearlySavings")}
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ministry" />{t("features.allFeatures")}</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ministry" />{t("features.saveYearly")}</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ministry" />{t("features.prioritySupport")}</li>
            </ul>
            <Button render={<Link href={`/${locale}/signup`} />} className="w-full mt-6">
              {t("cta.subscribe")}
            </Button>
          </div>
        </div>

        {/* Monthly */}
        <div className="rounded-card border border-border-whisper bg-surface-elevated p-6 shadow-diffused-sm mb-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">{t("plans.monthly")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("plans.monthlyDescription")}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">499 EGP</p>
              <p className="text-xs text-muted-foreground">{t("plans.monthlyPeriod")}</p>
            </div>
          </div>
        </div>

        {/* Feature Comparison */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight text-center mb-8">
            {t("comparison.title")}
          </h2>
          <div className="rounded-card border border-border-whisper bg-surface-elevated overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-whisper">
                  <th className="p-4 text-start font-medium text-muted-foreground">{t("comparison.feature")}</th>
                  <th className="p-4 text-center font-medium">{t("plans.free")}</th>
                  <th className="p-4 text-center font-medium">{t("plans.monthly")}</th>
                  <th className="p-4 text-center font-medium">{t("plans.yearly")}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  "services", "stages", "servants", "beneficiaries", "events",
                  "advancedReports", "analytics", "ai", "bulkImport", "export",
                ].map((feature) => (
                  <tr key={feature} className="border-b border-border-whisper last:border-b-0">
                    <td className="p-4 text-muted-foreground">{t(`comparison.features.${feature}`)}</td>
                    <td className="p-4 text-center">{t(`comparison.limits.free.${feature}`)}</td>
                    <td className="p-4 text-center text-ministry font-medium">{t(`comparison.limits.paid.${feature}`)}</td>
                    <td className="p-4 text-center text-ministry font-medium">{t(`comparison.limits.paid.${feature}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trial Info */}
        <div className="rounded-card border border-border-whisper bg-surface-elevated p-6 mb-12">
          <h2 className="text-xl font-semibold tracking-tight">{t("trialInfo.title")}</h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>{t("trialInfo.howItWorks")}</p>
            <ul className="list-disc ps-5 space-y-1">
              <li>{t("trialInfo.point1")}</li>
              <li>{t("trialInfo.point2")}</li>
              <li>{t("trialInfo.point3")}</li>
              <li>{t("trialInfo.point4")}</li>
            </ul>
          </div>
        </div>

        {/* Payment Method */}
        <div className="rounded-card border border-border-whisper bg-surface-elevated p-6 mb-12">
          <h2 className="text-xl font-semibold tracking-tight">{t("paymentMethod.title")}</h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>{t("paymentMethod.description")}</p>
            <ol className="list-decimal ps-5 space-y-1">
              <li>{t("paymentMethod.step1")}</li>
              <li>{t("paymentMethod.step2")}</li>
              <li>{t("paymentMethod.step3")}</li>
              <li>{t("paymentMethod.step4")}</li>
              <li>{t("paymentMethod.step5")}</li>
            </ol>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight text-center mb-8">
            {t("faq.title")}
          </h2>
          <div className="space-y-4">
            {[
              "paymentProcess",
              "activationTime",
              "dataAfterExpiry",
              "refundPolicy",
              "contactSupport",
            ].map((faq) => (
              <div key={faq} className="rounded-card border border-border-whisper bg-surface-elevated p-5">
                <h3 className="font-medium">{t(`faq.${faq}.question`)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(`faq.${faq}.answer`)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mb-12">
          <h2 className="text-2xl font-semibold tracking-tight">{t("cta.title")}</h2>
          <p className="mt-2 text-muted-foreground">{t("cta.description")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button render={<Link href={`/${locale}/signup`} />} className="h-12 px-6">
              {t("cta.getStarted")}
            </Button>
            <Button render={<Link href={`/${locale}/contact`} />} variant="outline" className="h-12 px-6">
              {t("cta.contactUs")}
            </Button>
          </div>
        </div>

        <footer className="border-t border-border-whisper py-6 text-center text-xs text-muted-foreground">
          {t("footer")}
        </footer>
      </div>
    </main>
  );
}
