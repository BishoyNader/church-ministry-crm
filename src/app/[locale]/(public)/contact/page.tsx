import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Mail, Phone, MessageCircle } from "lucide-react";
import { BILLING_CONFIG } from "@/features/billing/types/billing.types";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations("public.contact");

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
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
            {t("description")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-12">
          <div className="rounded-card border border-border-whisper bg-surface-elevated p-6 shadow-diffused-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Mail className="size-5" />
              </div>
              <div>
                <h3 className="font-medium">{t("email.title")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("email.description")}</p>
                <a
                  href={`mailto:${BILLING_CONFIG.supportEmail}`}
                  className="mt-2 inline-block text-sm text-primary hover:underline"
                >
                  {BILLING_CONFIG.supportEmail}
                </a>
              </div>
            </div>
          </div>

          {BILLING_CONFIG.supportPhone !== "+20-PLACEHOLDER" && (
            <div className="rounded-card border border-border-whisper bg-surface-elevated p-6 shadow-diffused-sm">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-ministry/10 p-3 text-ministry">
                  <Phone className="size-5" />
                </div>
                <div>
                  <h3 className="font-medium">{t("phone.title")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t("phone.description")}</p>
                  <p className="mt-2 text-sm font-medium">{BILLING_CONFIG.supportPhone}</p>
                </div>
              </div>
            </div>
          )}

          {BILLING_CONFIG.supportWhatsApp !== "+20-PLACEHOLDER" && (
            <div className="rounded-card border border-border-whisper bg-surface-elevated p-6 shadow-diffused-sm">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-success/10 p-3 text-success">
                  <MessageCircle className="size-5" />
                </div>
                <div>
                  <h3 className="font-medium">{t("whatsapp.title")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t("whatsapp.description")}</p>
                  <p className="mt-2 text-sm font-medium">{BILLING_CONFIG.supportWhatsApp}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-card border border-border-whisper bg-surface-elevated p-6 mb-12">
          <h2 className="text-xl font-semibold tracking-tight">{t("supportInfo.title")}</h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>{t("supportInfo.description")}</p>
            <ul className="list-disc ps-5 space-y-1">
              <li>{t("supportInfo.point1")}</li>
              <li>{t("supportInfo.point2")}</li>
              <li>{t("supportInfo.point3")}</li>
            </ul>
          </div>
        </div>

        <footer className="border-t border-border-whisper py-6 text-center text-xs text-muted-foreground">
          {t("footer")}
        </footer>
      </div>
    </main>
  );
}
