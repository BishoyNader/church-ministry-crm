import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-20 dark:bg-slate-950">
      <AuthCard title={t("resetPassword.title")} description={t("resetPassword.description")}>
        <ResetPasswordForm locale={locale} />
      </AuthCard>
    </main>
  );
}
