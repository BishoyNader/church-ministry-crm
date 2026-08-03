import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/features/auth/components/auth-card";
import { AuthPage } from "@/components/layout/auth-page";
import { SignupForm } from "@/features/auth/components/signup-form";
import { signupAction } from "@/features/auth/actions/auth.actions";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <AuthPage locale={locale}>
      <AuthCard title={t("signup.title")} description={t("signup.description")}>
        <SignupForm action={signupAction} locale={locale} />
      </AuthCard>
    </AuthPage>
  );
}
