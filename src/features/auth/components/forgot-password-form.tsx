"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { forgotPasswordSchema } from "../schemas/auth.schema";
import type { AuthActionResult } from "../actions/auth.actions";
import type { ForgotPasswordFormValues } from "../types/auth.types";

export function ForgotPasswordForm({
  action,
  locale,
}: {
  action: (values: ForgotPasswordFormValues, locale: string) => Promise<AuthActionResult>;
  locale: string;
}) {
  const t = useTranslations("auth");
  const [formState, setFormState] = useState<{ message?: string; error?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setFormState({});
    setIsLoading(true);

    const result = await action(values, locale);

    if (!result.success) {
      setFormState({ error: result.message ?? t("auth.generalError") });
    } else {
      setFormState({ message: result.message ?? t("forgotPassword.sent") });
    }

    setIsLoading(false);
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {formState.error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {formState.error}
        </div>
      ) : null}
      {formState.message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-900/20 dark:text-emerald-200">
          {formState.message}
        </div>
      ) : null}

      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {t("forgotPassword.email")}
        <input
          type="email"
          autoComplete="email"
          {...register("email")}
          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        {errors.email ? <p className="mt-1 text-xs text-destructive">{errors.email.message}</p> : null}
      </label>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? t("auth.loading") : t("forgotPassword.submit")}
      </Button>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        {t("forgotPassword.remembered")} <a href={`/${locale}/login`} className="font-semibold text-primary hover:underline">{t("forgotPassword.login")}</a>
      </p>
    </form>
  );
}
