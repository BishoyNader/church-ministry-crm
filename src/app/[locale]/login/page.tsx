import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/features/auth/components/auth-card";
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
  const signupSuccess = resolvedSearchParams.signup === "success";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-20 dark:bg-slate-950">
      <AuthCard title={t("login.title")} description={t("login.description")}>
        {signupSuccess ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-900/20 dark:text-emerald-200">
            {t("signup.successMessage")}
          </div>
        ) : null}
        <LoginForm action={loginAction} locale={locale} />
      </AuthCard>
    </main>
  );
}
