import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/features/auth/components/auth-card";
import { AuthPage } from "@/components/layout/auth-page";
import { LoginForm } from "@/features/auth/components/login-form";
import { loginAction } from "@/features/auth/actions/auth.actions";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const signupPending = resolvedSearchParams.signup === "pending";
  const signupSuccess = resolvedSearchParams.signup === "success";

  return (
    <AuthPage locale={locale}>
      <AuthCard title={t("login.title")} description={t("login.description")}>
        {signupPending ? (
          <div className="mb-6 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning" role="status">
            {t("signup.pendingMessage")}
          </div>
        ) : null}
        {signupSuccess ? (
          <div className="mb-6 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success" role="status">
            {t("signup.successMessage")}
          </div>
        ) : null}
        <LoginForm action={loginAction} locale={locale} />
      </AuthCard>
    </AuthPage>
  );
}
