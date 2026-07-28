"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { loginSchema } from "../schemas/auth.schema";
import type { LoginFormValues } from "../types/auth.types";
import type { AuthActionResult } from "../actions/auth.actions";

export function LoginForm({
  action,
  locale,
}: {
  action: (values: LoginFormValues, locale: string) => Promise<AuthActionResult>;
  locale: string;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { remember: true },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);
    setIsLoading(true);

    const result = await action(values, locale);

    if (!result.success) {
      setFormError(result.message ?? t("generalError"));
      setIsLoading(false);
      return;
    }

    if (result.redirectTo) {
      router.push(result.redirectTo);
    }

    setIsLoading(false);
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {formError ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          {t("login.emailLabel")}
          <input
            type="email"
            autoComplete="email"
            {...register("email")}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          {errors.email ? <p className="mt-1 text-xs text-destructive">{errors.email.message}</p> : null}
        </label>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          {t("login.passwordLabel")}
          <input
            type="password"
            autoComplete="current-password"
            {...register("password")}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          {errors.password ? <p className="mt-1 text-xs text-destructive">{errors.password.message}</p> : null}
        </label>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm text-slate-600 dark:text-slate-300">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" {...register("remember")} />
          {t("login.rememberMe")}
        </label>
        <Link href={`/${locale}/forgot-password`} className="font-medium text-primary hover:underline">
          {t("login.forgotPassword")}
        </Link>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? t("loading") : t("login.submit")}
      </Button>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        {t("login.noAccount")} <Link href={`/${locale}/signup`} className="font-semibold text-primary hover:underline">{t("login.createAccount")}</Link>
      </p>
    </form>
  );
}
