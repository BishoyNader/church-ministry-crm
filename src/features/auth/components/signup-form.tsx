"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { signupSchema } from "../schemas/auth.schema";
import type { AuthActionResult } from "../actions/auth.actions";
import type { SignupFormValues } from "../types/auth.types";

export function SignupForm({
  action,
  locale,
}: {
  action: (values: SignupFormValues, locale: string) => Promise<AuthActionResult>;
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
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (values: SignupFormValues) => {
    setFormError(null);
    setIsLoading(true);

    const result = await action(values, locale);

    if (!result.success) {
      setFormError(result.message ?? t("auth.generalError"));
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
          {t("signup.churchNameAr")}
          <input
            type="text"
            autoComplete="organization"
            {...register("churchNameAr")}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          {errors.churchNameAr ? <p className="mt-1 text-xs text-destructive">{errors.churchNameAr.message}</p> : null}
        </label>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          {t("signup.churchNameEn")}
          <input
            type="text"
            autoComplete="organization"
            {...register("churchNameEn")}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          {t("signup.fullNameAr")}
          <input
            type="text"
            autoComplete="name"
            {...register("fullNameAr")}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          {errors.fullNameAr ? <p className="mt-1 text-xs text-destructive">{errors.fullNameAr.message}</p> : null}
        </label>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          {t("signup.fullNameEn")}
          <input
            type="text"
            autoComplete="name"
            {...register("fullNameEn")}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          {t("signup.email")}
          <input
            type="email"
            autoComplete="email"
            {...register("email")}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          {errors.email ? <p className="mt-1 text-xs text-destructive">{errors.email.message}</p> : null}
        </label>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          {t("signup.password")}
          <input
            type="password"
            autoComplete="new-password"
            {...register("password")}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          {errors.password ? <p className="mt-1 text-xs text-destructive">{errors.password.message}</p> : null}
        </label>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          {t("signup.confirmPassword")}
          <input
            type="password"
            autoComplete="new-password"
            {...register("confirmPassword")}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          {errors.confirmPassword ? <p className="mt-1 text-xs text-destructive">{errors.confirmPassword.message}</p> : null}
        </label>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? t("auth.loading") : t("signup.submit")}
      </Button>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        {t("signup.haveAccount")} <a href={`/${locale}/login`} className="font-semibold text-primary hover:underline">{t("signup.signIn")}</a>
      </p>
    </form>
  );
}
