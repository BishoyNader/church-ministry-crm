import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/features/auth/components/auth-card";
import { AuthPage } from "@/components/layout/auth-page";
import { ChurchRequestForm } from "@/features/churches/components/church-request-form";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function ChurchRequestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations("churches.request");

  return (
    <AuthPage locale={locale}>
      <AuthCard title={t("title")} description={t("description")}>
        <ChurchRequestForm locale={locale} />
      </AuthCard>
    </AuthPage>
  );
}
